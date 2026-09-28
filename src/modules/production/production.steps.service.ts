import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  orderItems,
  orders,
  orderStatusHistory,
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
const MODEL_STAGE_CODES = ['modeling', 'model-approval', 'fitting-print'];

@Injectable()
export class ProductionStepsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Adds production steps to an order item. Stages the item already has are
   * skipped, so applying a template twice is harmless. The template adds
   * engraving and coating stages when the item needs them and leaves out
   * 3D model stages for custom orders approved without a model.
   */
  async create(
    orderId: string,
    itemId: string,
    dto: CreateProductionStepsDto,
  ): Promise<void> {
    const [item] = await this.db
      .select({
        id: orderItems.id,
        kind: orders.kind,
        status: orders.status,
        productionPaymentAmount: orders.productionPaymentAmount,
        selectedOptions: orderItems.selectedOptions,
        engravingText: orderItems.engravingText,
        specification: orderItems.specification,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)));

    if (!item) {
      throw new NotFoundException('Order item not found');
    }

    if (CLOSED_ORDER_STATUSES.includes(item.status)) {
      throw new ConflictException('The order is closed');
    }

    const stages = dto.stageIds
      ? await this.db
          .select({
            id: productionStages.id,
            code: productionStages.code,
            sortOrder: productionStages.sortOrder,
          })
          .from(productionStages)
          .where(inArray(productionStages.id, dto.stageIds))
          .orderBy(asc(productionStages.sortOrder))
      : await this.templateStages(orderId, item);

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

  /** Sets the order of all steps of an order item. */
  async reorder(orderId: string, itemId: string, ids: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const current = await tx
        .select({ id: productionSteps.id })
        .from(productionSteps)
        .innerJoin(orderItems, eq(orderItems.id, productionSteps.orderItemId))
        .where(
          and(
            eq(productionSteps.orderItemId, itemId),
            eq(orderItems.orderId, orderId),
          ),
        );
      const known = new Set(current.map((step) => step.id));

      if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
        throw new BadRequestException(
          'ids must list every production step of the item exactly once',
        );
      }

      for (const [index, id] of ids.entries()) {
        await tx
          .update(productionSteps)
          .set({ sortOrder: (index + 1) * 10 })
          .where(eq(productionSteps.id, id));
      }
    });
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

  private async templateStages(
    orderId: string,
    item: {
      kind: 'catalog' | 'custom';
      productionPaymentAmount: number | null;
      selectedOptions: Array<{ kind: string }>;
      engravingText: string | null;
      specification: {
        engraving: unknown;
        coating: unknown;
      } | null;
    },
  ) {
    const needed: string[] = [];

    if (
      item.engravingText ||
      item.specification?.engraving ||
      item.selectedOptions.some((option) => option.kind === 'engraving')
    ) {
      needed.push('engraving');
    }

    if (
      item.specification?.coating ||
      item.selectedOptions.some((option) => option.kind === 'coating')
    ) {
      needed.push('coating');
    }

    const stages = await this.db
      .select({
        id: productionStages.id,
        code: productionStages.code,
        sortOrder: productionStages.sortOrder,
      })
      .from(productionStages)
      .where(
        and(
          eq(productionStages.isActive, true),
          or(
            item.kind === 'custom'
              ? eq(productionStages.defaultForCustom, true)
              : eq(productionStages.defaultForCatalog, true),
            inArray(productionStages.code, needed),
          ),
        ),
      )
      .orderBy(asc(productionStages.sortOrder));

    if (item.productionPaymentAmount === null) {
      return stages;
    }

    const [modelStatus] = await this.db
      .select({ id: orderStatusHistory.id })
      .from(orderStatusHistory)
      .where(
        and(
          eq(orderStatusHistory.orderId, orderId),
          inArray(orderStatusHistory.toStatus, [
            'awaiting_model_payment',
            'modeling',
          ]),
        ),
      )
      .limit(1);

    return modelStatus
      ? stages
      : stages.filter((stage) => !MODEL_STAGE_CODES.includes(stage.code));
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
