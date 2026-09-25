import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { and, count, desc, eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import {
  customers,
  customRequests,
} from '../../integrations/database/database.schema';
import type {
  CustomRequest,
  CustomRequestStatus,
} from '../../integrations/database/database.schema';
import { toOffset, toPage } from '../../shared/pagination/pagination';
import type { PaginationQueryDto } from '../../shared/pagination/pagination.query.dto';
import { CustomersService } from '../customers/customers.service';
import { customerUploadFolder } from '../media/media.folders';
import { OrdersService } from '../orders/orders.service';
import { canTransitionCustomRequest } from './custom.request.status';
import type {
  AcceptCustomRequestDto,
  AdminCustomRequestDto,
  AdminCustomRequestListQueryDto,
  AdminCustomRequestPageDto,
  CreateCustomRequestDto,
  CustomRequestDto,
  CustomRequestPageDto,
  QuoteCustomRequestDto,
  UpdateCustomRequestDto,
} from './custom.request.dto';

const customerColumns = {
  id: customers.id,
  phone: customers.phone,
  firstName: customers.firstName,
  lastName: customers.lastName,
};

@Injectable()
export class CustomRequestsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly cloudinary: CloudinaryService,
    private readonly customers: CustomersService,
    private readonly orders: OrdersService,
  ) {}

  async create(
    user: User,
    dto: CreateCustomRequestDto,
  ): Promise<CustomRequestDto> {
    const folder = customerUploadFolder(this.cloudinary, user.id);

    if (
      dto.referenceImages?.some(
        (image) => !this.cloudinary.isOwnedAsset(image, folder),
      )
    ) {
      throw new BadRequestException(
        'Reference images must be uploaded with your upload signature',
      );
    }

    if (
      dto.budgetMin !== undefined &&
      dto.budgetMax !== undefined &&
      dto.budgetMin > dto.budgetMax
    ) {
      throw new BadRequestException('budgetMin must not exceed budgetMax');
    }

    const request = await this.db.transaction(async (tx) => {
      await this.customers.ensure(user, tx);
      const [created] = await tx
        .insert(customRequests)
        .values({ ...dto, customerId: user.id })
        .returning();
      return created;
    });

    return this.toDto(request);
  }

  async listForCustomer(
    user: User,
    query: PaginationQueryDto,
  ): Promise<CustomRequestPageDto> {
    const where = eq(customRequests.customerId, user.id);
    const [items, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(customRequests)
        .where(where)
        .orderBy(desc(customRequests.createdAt))
        .limit(query.pageSize)
        .offset(toOffset(query)),
      this.db.select({ total: count() }).from(customRequests).where(where),
    ]);

    return toPage(
      items.map((item) => this.toDto(item)),
      total,
      query,
    );
  }

  async getForCustomer(user: User, id: string): Promise<CustomRequestDto> {
    return this.toDto(await this.findOwned(this.db, user, id));
  }

  /** Accepts the quote and creates a custom order awaiting payment. */
  async accept(
    user: User,
    id: string,
    dto: AcceptCustomRequestDto,
  ): Promise<CustomRequestDto> {
    const contactPhone = this.orders.contactPhone(user, dto.contactPhone);

    const request = await this.db.transaction(async (tx) => {
      const current = await this.findOwned(tx, user, id, true);
      this.assertTransition(current.status, 'accepted');

      const orderId = await this.orders.createCustomOrder(tx, {
        customerId: user.id,
        contact: { ...dto, contactPhone },
        productName: current.quoteTitle!,
        imageUrl: current.referenceImages[0]?.url ?? null,
        price: current.quotePrice!,
        depositAmount: current.quoteDepositAmount,
        productionDaysMin: current.quoteProductionDaysMin!,
        productionDaysMax: current.quoteProductionDaysMax!,
        changedBy: user.id,
      });
      const [updated] = await tx
        .update(customRequests)
        .set({ status: 'accepted', orderId })
        .where(eq(customRequests.id, id))
        .returning();
      return updated;
    });

    return this.toDto(request);
  }

  async decline(user: User, id: string): Promise<CustomRequestDto> {
    const request = await this.db.transaction(async (tx) => {
      const current = await this.findOwned(tx, user, id, true);
      this.assertTransition(current.status, 'declined');
      const [updated] = await tx
        .update(customRequests)
        .set({ status: 'declined' })
        .where(eq(customRequests.id, id))
        .returning();
      return updated;
    });

    return this.toDto(request);
  }

  async list(
    query: AdminCustomRequestListQueryDto,
  ): Promise<AdminCustomRequestPageDto> {
    const where = query.status
      ? eq(customRequests.status, query.status)
      : undefined;
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ request: customRequests, customer: customerColumns })
        .from(customRequests)
        .innerJoin(customers, eq(customers.id, customRequests.customerId))
        .where(where)
        .orderBy(desc(customRequests.createdAt))
        .limit(query.pageSize)
        .offset(toOffset(query)),
      this.db.select({ total: count() }).from(customRequests).where(where),
    ]);

    return toPage(
      rows.map((row) => this.toAdminDto(row.request, row.customer)),
      total,
      query,
    );
  }

  async get(id: string): Promise<AdminCustomRequestDto> {
    const [row] = await this.db
      .select({ request: customRequests, customer: customerColumns })
      .from(customRequests)
      .innerJoin(customers, eq(customers.id, customRequests.customerId))
      .where(eq(customRequests.id, id));

    if (!row) {
      throw new NotFoundException('Custom request not found');
    }

    return this.toAdminDto(row.request, row.customer);
  }

  async update(
    id: string,
    dto: UpdateCustomRequestDto,
  ): Promise<AdminCustomRequestDto> {
    await this.db.transaction(async (tx) => {
      const current = await this.lock(tx, eq(customRequests.id, id));

      if (dto.status) {
        this.assertTransition(current.status, dto.status);
      }

      await tx.update(customRequests).set(dto).where(eq(customRequests.id, id));
    });

    return this.get(id);
  }

  async quote(
    id: string,
    dto: QuoteCustomRequestDto,
  ): Promise<AdminCustomRequestDto> {
    if (dto.productionDaysMin > dto.productionDaysMax) {
      throw new BadRequestException(
        'productionDaysMin must not exceed productionDaysMax',
      );
    }

    if (dto.depositAmount !== undefined && dto.depositAmount >= dto.price) {
      throw new BadRequestException('depositAmount must be less than price');
    }

    await this.db.transaction(async (tx) => {
      const current = await this.lock(tx, eq(customRequests.id, id));
      this.assertTransition(current.status, 'quoted');

      await tx
        .update(customRequests)
        .set({
          status: 'quoted',
          quoteTitle: dto.title,
          quotePrice: dto.price,
          quoteDepositAmount: dto.depositAmount ?? null,
          quoteProductionDaysMin: dto.productionDaysMin,
          quoteProductionDaysMax: dto.productionDaysMax,
          quoteNote: dto.note ?? null,
        })
        .where(eq(customRequests.id, id));
    });

    return this.get(id);
  }

  private findOwned(
    executor: DatabaseExecutor,
    user: User,
    id: string,
    forUpdate = false,
  ): Promise<CustomRequest> {
    const where = and(
      eq(customRequests.id, id),
      eq(customRequests.customerId, user.id),
    )!;

    return forUpdate ? this.lock(executor, where) : this.find(executor, where);
  }

  private async find(
    executor: DatabaseExecutor,
    where: SQL,
  ): Promise<CustomRequest> {
    const [request] = await executor.select().from(customRequests).where(where);

    if (!request) {
      throw new NotFoundException('Custom request not found');
    }

    return request;
  }

  private async lock(
    executor: DatabaseExecutor,
    where: SQL,
  ): Promise<CustomRequest> {
    const [request] = await executor
      .select()
      .from(customRequests)
      .where(where)
      .for('update');

    if (!request) {
      throw new NotFoundException('Custom request not found');
    }

    return request;
  }

  private assertTransition(
    from: CustomRequestStatus,
    to: CustomRequestStatus,
  ): void {
    if (!canTransitionCustomRequest(from, to)) {
      throw new ConflictException(
        `A ${from} custom request cannot become ${to}`,
      );
    }
  }

  private toDto(request: CustomRequest): CustomRequestDto {
    return {
      id: request.id,
      status: request.status,
      productType: request.productType,
      description: request.description,
      referenceImages: request.referenceImages,
      budgetMin: request.budgetMin,
      budgetMax: request.budgetMax,
      desiredMetal: request.desiredMetal,
      ringSize: request.ringSize,
      quote:
        request.quotePrice === null
          ? null
          : {
              title: request.quoteTitle,
              price: request.quotePrice,
              depositAmount: request.quoteDepositAmount,
              productionDaysMin: request.quoteProductionDaysMin,
              productionDaysMax: request.quoteProductionDaysMax,
              note: request.quoteNote,
            },
      orderId: request.orderId,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private toAdminDto(
    request: CustomRequest,
    customer: AdminCustomRequestDto['customer'],
  ): AdminCustomRequestDto {
    return { ...this.toDto(request), adminNote: request.adminNote, customer };
  }
}
