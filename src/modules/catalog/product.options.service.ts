import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import {
  optionGroups,
  optionValues,
  products,
} from '../../integrations/database/database.schema';
import type { OptionGroup } from '../../integrations/database/database.schema';
import { withConflictMapping } from '../../shared/errors/conflict.mapping';
import type {
  CreateOptionGroupDto,
  CreateOptionValueDto,
  UpdateOptionGroupDto,
  UpdateOptionValueDto,
} from './dto/product.dto';

const MISSING_REFERENCE = 'Referenced metal or gemstone does not exist';

@Injectable()
export class ProductOptionsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async createGroup(
    productId: string,
    dto: CreateOptionGroupDto,
  ): Promise<OptionGroup> {
    const [product] = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const [group] = await this.db
      .insert(optionGroups)
      .values({ ...dto, productId })
      .returning();
    return group;
  }

  async updateGroup(
    productId: string,
    groupId: string,
    dto: UpdateOptionGroupDto,
  ): Promise<OptionGroup> {
    const [group] = await this.db
      .update(optionGroups)
      .set(dto)
      .where(this.groupWhere(productId, groupId))
      .returning();

    if (!group) {
      throw new NotFoundException('Option group not found');
    }

    return group;
  }

  async deleteGroup(productId: string, groupId: string): Promise<void> {
    const [group] = await this.db
      .delete(optionGroups)
      .where(this.groupWhere(productId, groupId))
      .returning({ id: optionGroups.id });

    if (!group) {
      throw new NotFoundException('Option group not found');
    }
  }

  async createValue(
    productId: string,
    groupId: string,
    dto: CreateOptionValueDto,
  ) {
    await this.findGroup(productId, groupId);

    return withConflictMapping(
      this.db.transaction(async (tx) => {
        const [value] = await tx
          .insert(optionValues)
          .values({ ...dto, groupId })
          .returning();
        await this.keepSingleDefault(tx, value);
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
    await this.findGroup(productId, groupId);

    const value = await withConflictMapping(
      this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(optionValues)
          .set(dto)
          .where(
            and(
              eq(optionValues.id, valueId),
              eq(optionValues.groupId, groupId),
            ),
          )
          .returning();

        if (updated) {
          await this.keepSingleDefault(tx, updated);
        }

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

    const [value] = await this.db
      .delete(optionValues)
      .where(
        and(eq(optionValues.id, valueId), eq(optionValues.groupId, groupId)),
      )
      .returning({ id: optionValues.id });

    if (!value) {
      throw new NotFoundException('Option value not found');
    }
  }

  private groupWhere(productId: string, groupId: string) {
    return and(
      eq(optionGroups.id, groupId),
      eq(optionGroups.productId, productId),
    );
  }

  private async findGroup(productId: string, groupId: string) {
    const [group] = await this.db
      .select()
      .from(optionGroups)
      .where(this.groupWhere(productId, groupId));

    if (!group) {
      throw new NotFoundException('Option group not found');
    }

    return group;
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
