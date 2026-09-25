import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  orderItems,
  orders,
  productionStages,
  productionSteps,
} from '../../integrations/database/database.schema';
import type { OrderStatus } from '../../integrations/database/database.schema';
import type {
  CreateProductionStepsDto,
  UpdateProductionStepDto,
} from './dto/production.step.dto';
import { stepDates } from './production.step.state';

const CLOSED_ORDER_STATUSES: OrderStatus[] = ['cancelled', 'refunded'];

@Injectable()
export class ProductionStepsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Adds production steps to an order item. Stages the item already has are
   * skipped, so applying a template twice is harmless.
   */
  async create(
    orderId: string,
    itemId: string,
    dto: CreateProductionStepsDto,
  ): Promise<void> {
    const [item] = await this.db
      .select({ id: orderItems.id, kind: orders.kind, status: orders.status })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)));

    if (!item) {
      throw new NotFoundException('Order item not found');
    }

    if (CLOSED_ORDER_STATUSES.includes(item.status)) {
      throw new ConflictException('The order is closed');
    }

    const stages = await this.db
      .select({
        id: productionStages.id,
        sortOrder: productionStages.sortOrder,
      })
      .from(productionStages)
      .where(
        dto.stageIds
          ? inArray(productionStages.id, dto.stageIds)
          : and(
              eq(productionStages.isActive, true),
              item.kind === 'custom'
                ? eq(productionStages.defaultForCustom, true)
                : eq(productionStages.defaultForCatalog, true),
            ),
      )
      .orderBy(asc(productionStages.sortOrder));

    if (dto.stageIds && stages.length !== dto.stageIds.length) {
      throw new BadRequestException('Unknown production stage');
    }

    if (!stages.length) {
      return;
    }

    await this.db
      .insert(productionSteps)
      .values(
        stages.map((stage) => ({
          orderItemId: itemId,
          stageId: stage.id,
          sortOrder: stage.sortOrder,
        })),
      )
      .onConflictDoNothing();
  }

  /** Updates a step and returns the id of its order. */
  async update(stepId: string, dto: UpdateProductionStepDto): Promise<string> {
    const step = await this.find(stepId);
    const folder = this.cloudinary.folder('production');

    if (
      dto.images?.some((image) => !this.cloudinary.isOwnedAsset(image, folder))
    ) {
      throw new BadRequestException(
        `Production photos must be uploaded to ${folder}`,
      );
    }

    await this.db
      .update(productionSteps)
      .set({
        ...dto,
        ...(dto.state ? stepDates(step, dto.state) : {}),
      })
      .where(eq(productionSteps.id, stepId));

    return step.orderId;
  }

  /** Deletes a step and returns the id of its order. */
  async delete(stepId: string): Promise<string> {
    const step = await this.find(stepId);
    await this.db.delete(productionSteps).where(eq(productionSteps.id, stepId));
    return step.orderId;
  }

  private async find(stepId: string) {
    const [step] = await this.db
      .select({
        startedAt: productionSteps.startedAt,
        completedAt: productionSteps.completedAt,
        orderId: orderItems.orderId,
      })
      .from(productionSteps)
      .innerJoin(orderItems, eq(orderItems.id, productionSteps.orderItemId))
      .where(eq(productionSteps.id, stepId));

    if (!step) {
      throw new NotFoundException('Production step not found');
    }

    return step;
  }
}
