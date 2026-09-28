import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import {
  finishingOptions,
  gemstones,
  metals,
  optionGroups,
  optionValues,
  products,
} from '../../integrations/database/database.schema';
import type {
  OptionGroup,
  OptionValue,
  ProductType,
} from '../../integrations/database/database.schema';
import { withConflictMapping } from '../../shared/errors/conflict.mapping';
import type {
  CreateOptionGroupDto,
  CreateOptionValueDto,
  UpdateOptionGroupDto,
  UpdateOptionValueDto,
} from './dto/product.dto';
import { defaultGroupName, valueLabel } from './product.labels';
import { refreshPriceFrom } from './product.pricing';

const MISSING_REFERENCE =
  'Referenced metal, gemstone, or operation does not exist';

/**
 * Edits single option groups and values. The admin editor saves the whole
 * configuration through `ProductsService` instead.
 */
@Injectable()
export class ProductOptionsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async createGroup(
    productId: string,
    dto: CreateOptionGroupDto,
  ): Promise<OptionGroup> {
    const product = await this.findProduct(productId);
    const [group] = await this.db
      .insert(optionGroups)
      .values({
        ...dto,
        name: dto.name?.trim() || defaultGroupName(dto.kind, product.type),
        productId,
      })
      .returning();
    return group;
  }

  async updateGroup(
    productId: string,
    groupId: string,
    dto: UpdateOptionGroupDto,
  ): Promise<OptionGroup> {
    const product = await this.findProduct(productId);
    const [group] = await this.db.transaction(async (tx) => {
      const updated = await tx
        .update(optionGroups)
        .set({
          ...dto,
          name:
            dto.name === undefined
              ? undefined
              : dto.name.trim() ||
                defaultGroupName(dto.kind ?? 'custom', product.type),
        })
        .where(this.groupWhere(productId, groupId))
        .returning();
      await refreshPriceFrom(tx, eq(products.id, productId));
      return updated;
    });

    if (!group) {
      throw new NotFoundException('Option group not found');
    }

    return group;
  }

  async deleteGroup(productId: string, groupId: string): Promise<void> {
    const [group] = await this.db.transaction(async (tx) => {
      const deleted = await tx
        .delete(optionGroups)
        .where(this.groupWhere(productId, groupId))
        .returning({ id: optionGroups.id });
      await refreshPriceFrom(tx, eq(products.id, productId));
      return deleted;
    });

    if (!group) {
      throw new NotFoundException('Option group not found');
    }
  }

  async createValue(
    productId: string,
    groupId: string,
    dto: CreateOptionValueDto,
  ) {
    const group = await this.findGroup(productId, groupId);
    const label = await this.label(this.db, group, dto);

    return withConflictMapping(
      this.db.transaction(async (tx) => {
        const [value] = await tx
          .insert(optionValues)
          .values({ ...dto, label, groupId })
          .returning();
        await this.keepSingleDefault(tx, value);
        await refreshPriceFrom(tx, eq(products.id, productId));
        return value;
      }),
      { inUse: MISSING_REFERENCE },
    );
  }

  async updateValue(
    productId: string,
    groupId: string,
    valueId: string,
    dto: UpdateOptionValueDto,
  ) {
    const group = await this.findGroup(productId, groupId);

    const value = await withConflictMapping(
      this.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(optionValues)
          .where(
            and(
              eq(optionValues.id, valueId),
              eq(optionValues.groupId, groupId),
            ),
          );

        if (!current) {
          return undefined;
        }

        const label = await this.label(tx, group, { ...current, ...dto });
        const [updated] = await tx
          .update(optionValues)
          .set({ ...dto, label })
          .where(eq(optionValues.id, valueId))
          .returning();
        await this.keepSingleDefault(tx, updated);
        await refreshPriceFrom(tx, eq(products.id, productId));
        return updated;
      }),
      { inUse: MISSING_REFERENCE },
    );

    if (!value) {
      throw new NotFoundException('Option value not found');
    }

    return value;
  }

  async deleteValue(
    productId: string,
    groupId: string,
    valueId: string,
  ): Promise<void> {
    await this.findGroup(productId, groupId);

    const [value] = await this.db.transaction(async (tx) => {
      const deleted = await tx
        .delete(optionValues)
        .where(
          and(eq(optionValues.id, valueId), eq(optionValues.groupId, groupId)),
        )
        .returning({ id: optionValues.id });
      await refreshPriceFrom(tx, eq(products.id, productId));
      return deleted;
    });

    if (!value) {
      throw new NotFoundException('Option value not found');
    }
  }

  private async label(
    executor: DatabaseExecutor,
    group: OptionGroup & { productType: ProductType },
    value: Partial<OptionValue> & CreateOptionValueDto,
  ): Promise<string> {
    const [metal, gemstone, finishing] = await Promise.all([
      value.metalId
        ? executor
            .select({ name: metals.name })
            .from(metals)
            .where(eq(metals.id, value.metalId))
            .then((rows) => rows[0])
        : undefined,
      value.gemstoneId
        ? executor
            .select({ name: gemstones.name })
            .from(gemstones)
            .where(eq(gemstones.id, value.gemstoneId))
            .then((rows) => rows[0])
        : undefined,
      value.finishingId
        ? executor
            .select({ name: finishingOptions.name })
            .from(finishingOptions)
            .where(eq(finishingOptions.id, value.finishingId))
            .then((rows) => rows[0])
        : undefined,
    ]);
    const label = valueLabel(group.kind, group.productType, value, {
      metal,
      gemstone,
      finishing,
    });

    if (!label) {
      throw new BadRequestException('Option value needs a name');
    }

    return label;
  }

  private groupWhere(productId: string, groupId: string) {
    return and(
      eq(optionGroups.id, groupId),
      eq(optionGroups.productId, productId),
    );
  }

  private async findProduct(productId: string) {
    const [product] = await this.db
      .select({ id: products.id, type: products.type })
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private async findGroup(productId: string, groupId: string) {
    const [group] = await this.db
      .select({ group: optionGroups, productType: products.type })
      .from(optionGroups)
      .innerJoin(products, eq(products.id, optionGroups.productId))
      .where(this.groupWhere(productId, groupId));

    if (!group) {
      throw new NotFoundException('Option group not found');
    }

    return { ...group.group, productType: group.productType };
  }

  private async keepSingleDefault(
    executor: DatabaseExecutor,
    value: { id: string; groupId: string; isDefault: boolean },
  ): Promise<void> {
    if (!value.isDefault) {
      return;
    }

    await executor
      .update(optionValues)
      .set({ isDefault: false })
      .where(
        and(
          eq(optionValues.groupId, value.groupId),
          ne(optionValues.id, value.id),
        ),
      );
  }
}
