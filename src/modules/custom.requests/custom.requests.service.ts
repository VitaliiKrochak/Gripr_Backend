import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { and, count, desc, eq, inArray, max } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import {
  customers,
  customProposals,
  customRequests,
  messages,
} from '../../integrations/database/database.schema';
import type {
  CustomProposal,
  CustomRequest,
  CustomRequestStatus,
} from '../../integrations/database/database.schema';
import { toOffset, toPage } from '../../shared/pagination/pagination';
import type { PaginationQueryDto } from '../../shared/pagination/pagination.query.dto';
import { ProductCatalogService } from '../catalog/product.catalog.service';
import {
  configureProduct,
  ConfigurationError,
} from '../catalog/product.configuration';
import { CustomersService } from '../customers/customers.service';
import { customerUploadFolder } from '../media/media.folders';
import { OrdersService } from '../orders/orders.service';
import { resolveSpecification } from './custom.request.specification';
import { canTransitionCustomRequest } from './custom.request.status';
import type {
  AcceptCustomRequestDto,
  AdminCustomRequestDto,
  AdminCustomRequestListQueryDto,
  AdminCustomRequestPageDto,
  CreateCustomRequestDto,
  CreateProposalDto,
  CustomProposalDto,
  CustomRequestDto,
  CustomRequestPageDto,
  RequestProposalChangesDto,
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
    private readonly catalog: ProductCatalogService,
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

    const { specification, productId, optionValueIds, ...values } = dto;
    const customization = productId
      ? await this.customizationBase(productId, optionValueIds ?? [])
      : null;
    const productType = customization?.productType ?? values.productType;
    const resolved = specification
      ? await resolveSpecification(
          this.db,
          { ...specification, productType },
          { activeOnly: true },
        )
      : null;

    const request = await this.db.transaction(async (tx) => {
      await this.customers.ensure(user, tx);
      const [created] = await tx
        .insert(customRequests)
        .values({
          ...values,
          productType,
          specification: resolved,
          ...(customization
            ? {
                source: 'customization' as const,
                productId: customization.productId,
                productName: customization.productName,
                productSlug: customization.productSlug,
                baseOptions: customization.baseOptions,
              }
            : {}),
          customerId: user.id,
        })
        .returning();
      return created;
    });

    return this.toDto(request, []);
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
    const proposals = await this.proposalsFor(items.map((item) => item.id));

    return toPage(
      items.map((item) => this.toDto(item, proposals.get(item.id) ?? [])),
      total,
      query,
    );
  }

  async getForCustomer(user: User, id: string): Promise<CustomRequestDto> {
    const request = await this.findOwned(this.db, user, id);
    const proposals = await this.proposalsFor([id]);
    return this.toDto(request, proposals.get(id) ?? []);
  }

  /**
   * Approves the latest proposal and creates the custom order: 3D model
   * prepayment first (when a model is needed), then production prepayment.
   * Requests quoted before proposals existed keep the deposit flow.
   */
  async accept(
    user: User,
    id: string,
    dto: AcceptCustomRequestDto,
  ): Promise<CustomRequestDto> {
    const contactPhone = this.orders.contactPhone(user, dto.contactPhone);

    await this.db.transaction(async (tx) => {
      const current = await this.findOwned(tx, user, id, true);
      this.assertTransition(current.status, 'accepted');
      const proposal = await this.latestProposal(tx, id);
      const common = {
        customerId: user.id,
        contact: { ...dto, contactPhone },
        imageUrl: current.referenceImages[0]?.url ?? null,
        productId: current.productId,
        productSlug: current.productSlug,
        selectedOptions: current.baseOptions,
        changedBy: user.id,
      };
      let orderId: string;

      if (proposal) {
        orderId = await this.orders.createCustomOrder(tx, {
          ...common,
          productName: proposal.title,
          specification: proposal.specification,
          pricing: {
            kind: 'staged',
            requiresModel: proposal.requiresModel,
            modelPrice: proposal.modelPrice,
            productPrice: proposal.productPrice,
            productionPrepayment: proposal.productionPrepayment,
          },
          productionDaysMin: proposal.productionDaysMin,
          productionDaysMax: proposal.productionDaysMax,
        });
        await tx
          .update(customProposals)
          .set({ status: 'approved', respondedAt: new Date() })
          .where(eq(customProposals.id, proposal.id));
      } else {
        orderId = await this.orders.createCustomOrder(tx, {
          ...common,
          productName: current.quoteTitle!,
          specification: current.specification,
          pricing: {
            kind: 'legacy',
            price: current.quotePrice!,
            depositAmount: current.quoteDepositAmount,
          },
          productionDaysMin: current.quoteProductionDaysMin!,
          productionDaysMax: current.quoteProductionDaysMax!,
        });
      }

      await tx
        .update(customRequests)
        .set({ status: 'accepted', orderId })
        .where(eq(customRequests.id, id));
    });

    return this.getForCustomer(user, id);
  }

  /** The customer asks the workshop to revise the latest proposal. */
  async requestChanges(
    user: User,
    id: string,
    dto: RequestProposalChangesDto,
  ): Promise<CustomRequestDto> {
    await this.db.transaction(async (tx) => {
      const current = await this.findOwned(tx, user, id, true);
      this.assertTransition(current.status, 'changes_requested');
      const proposal = await this.latestProposal(tx, id);

      if (proposal) {
        await tx
          .update(customProposals)
          .set({
            status: 'changes_requested',
            customerResponse: dto.comment,
            respondedAt: new Date(),
          })
          .where(eq(customProposals.id, proposal.id));
      }

      await tx
        .update(customRequests)
        .set({ status: 'changes_requested' })
        .where(eq(customRequests.id, id));
      await tx.insert(messages).values({
        customRequestId: id,
        authorId: user.id,
        authorRole: 'customer',
        body: dto.comment,
      });
    });

    return this.getForCustomer(user, id);
  }

  async decline(user: User, id: string): Promise<CustomRequestDto> {
    await this.db.transaction(async (tx) => {
      const current = await this.findOwned(tx, user, id, true);
      this.assertTransition(current.status, 'declined');
      await tx
        .update(customRequests)
        .set({ status: 'declined' })
        .where(eq(customRequests.id, id));
    });

    return this.getForCustomer(user, id);
  }

  async list(
    query: AdminCustomRequestListQueryDto,
  ): Promise<AdminCustomRequestPageDto> {
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(customRequests.status, query.status));
    if (query.source) conditions.push(eq(customRequests.source, query.source));
    const where = conditions.length ? and(...conditions) : undefined;
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
    const proposals = await this.proposalsFor(
      rows.map((row) => row.request.id),
    );

    return toPage(
      rows.map((row) =>
        this.toAdminDto(
          row.request,
          row.customer,
          proposals.get(row.request.id) ?? [],
        ),
      ),
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

    const proposals = await this.proposalsFor([id]);
    return this.toAdminDto(row.request, row.customer, proposals.get(id) ?? []);
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

  /**
   * Sends a new proposal version. Earlier open versions are superseded and
   * the customer's original request stays untouched.
   */
  async createProposal(
    id: string,
    dto: CreateProposalDto,
    adminId: string,
  ): Promise<AdminCustomRequestDto> {
    if (dto.productionDaysMin > dto.productionDaysMax) {
      throw new BadRequestException(
        'productionDaysMin must not exceed productionDaysMax',
      );
    }

    if (dto.productionPrepayment > dto.productPrice) {
      throw new BadRequestException(
        'productionPrepayment must not exceed productPrice',
      );
    }

    const specification = await resolveSpecification(
      this.db,
      dto.specification,
      {
        activeOnly: false,
      },
    );
    const modelPrice = dto.requiresModel ? dto.modelPrice : 0;

    await this.db.transaction(async (tx) => {
      const current = await this.lock(tx, eq(customRequests.id, id));
      this.assertTransition(current.status, 'quoted');
      const [{ version }] = await tx
        .select({ version: max(customProposals.version) })
        .from(customProposals)
        .where(eq(customProposals.requestId, id));

      await tx
        .update(customProposals)
        .set({ status: 'superseded' })
        .where(
          and(
            eq(customProposals.requestId, id),
            inArray(customProposals.status, ['sent', 'changes_requested']),
          ),
        );
      await tx.insert(customProposals).values({
        requestId: id,
        version: (version ?? 0) + 1,
        title: dto.title,
        specification,
        requiresModel: dto.requiresModel,
        modelPrice,
        productPrice: dto.productPrice,
        productionPrepayment: dto.productionPrepayment,
        productionDaysMin: dto.productionDaysMin,
        productionDaysMax: dto.productionDaysMax,
        note: dto.note?.trim() || null,
        createdBy: adminId,
      });
      await tx
        .update(customRequests)
        .set({
          status: 'quoted',
          quoteTitle: dto.title,
          quotePrice: modelPrice + dto.productPrice,
          quoteDepositAmount: null,
          quoteProductionDaysMin: dto.productionDaysMin,
          quoteProductionDaysMax: dto.productionDaysMax,
          quoteNote: dto.note?.trim() || null,
        })
        .where(eq(customRequests.id, id));
    });

    return this.get(id);
  }

  private async customizationBase(productId: string, optionValueIds: string[]) {
    const product = (await this.catalog.loadConfigurable([productId])).get(
      productId,
    );

    if (!product) {
      throw new BadRequestException('The product is not available');
    }

    try {
      const configuration = configureProduct(product, optionValueIds);
      return {
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productType: product.type,
        baseOptions: configuration.selectedOptions,
      };
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private async latestProposal(
    executor: DatabaseExecutor,
    requestId: string,
  ): Promise<CustomProposal | undefined> {
    const [proposal] = await executor
      .select()
      .from(customProposals)
      .where(
        and(
          eq(customProposals.requestId, requestId),
          eq(customProposals.status, 'sent'),
        ),
      )
      .orderBy(desc(customProposals.version))
      .limit(1);
    return proposal;
  }

  private async proposalsFor(
    requestIds: string[],
  ): Promise<Map<string, CustomProposal[]>> {
    const rows = await this.db
      .select()
      .from(customProposals)
      .where(inArray(customProposals.requestId, requestIds))
      .orderBy(desc(customProposals.version));
    const byRequest = new Map<string, CustomProposal[]>();

    for (const row of rows) {
      byRequest.set(row.requestId, [
        ...(byRequest.get(row.requestId) ?? []),
        row,
      ]);
    }

    return byRequest;
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

  private toProposalDto(proposal: CustomProposal): CustomProposalDto {
    return {
      id: proposal.id,
      version: proposal.version,
      status: proposal.status,
      title: proposal.title,
      specification: proposal.specification,
      requiresModel: proposal.requiresModel,
      modelPrice: proposal.modelPrice,
      productPrice: proposal.productPrice,
      productionPrepayment: proposal.productionPrepayment,
      totalPrice: proposal.modelPrice + proposal.productPrice,
      productionDaysMin: proposal.productionDaysMin,
      productionDaysMax: proposal.productionDaysMax,
      note: proposal.note,
      customerResponse: proposal.customerResponse,
      respondedAt: proposal.respondedAt,
      createdAt: proposal.createdAt,
    };
  }

  private toDto(
    request: CustomRequest,
    proposals: CustomProposal[],
  ): CustomRequestDto {
    const proposalDtos = proposals.map((proposal) =>
      this.toProposalDto(proposal),
    );

    return {
      id: request.id,
      status: request.status,
      source: request.source,
      product: request.productName
        ? {
            id: request.productId,
            slug: request.productSlug,
            name: request.productName,
          }
        : null,
      baseOptions: request.baseOptions,
      productType: request.productType,
      description: request.description,
      referenceImages: request.referenceImages,
      budgetMin: request.budgetMin,
      budgetMax: request.budgetMax,
      desiredMetal: request.desiredMetal,
      ringSize: request.ringSize,
      specification: request.specification,
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
      proposal: proposalDtos[0] ?? null,
      proposals: proposalDtos,
      orderId: request.orderId,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private toAdminDto(
    request: CustomRequest,
    customer: AdminCustomRequestDto['customer'],
    proposals: CustomProposal[],
  ): AdminCustomRequestDto {
    return {
      ...this.toDto(request, proposals),
      adminNote: request.adminNote,
      customer,
    };
  }
}
