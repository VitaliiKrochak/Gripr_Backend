import { asc, eq, inArray } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../integrations/database/database.client';
import {
  optionGroups,
  optionValues,
  products,
} from '../../integrations/database/database.schema';
import { priceFrom } from './product.configuration';

/** Relations needed to price a product; shared by every configurable read. */
export const PRICING_RELATIONS = {
  stones: { columns: { quantity: true, unitPrice: true } },
  optionGroups: {
    orderBy: () => [asc(optionGroups.sortOrder), asc(optionGroups.createdAt)],
    with: {
      values: {
        orderBy: () => [
          asc(optionValues.sortOrder),
          asc(optionValues.createdAt),
        ],
        with: { metal: { columns: { pricePerGram: true } } },
      },
    },
  },
} as const;

/**
 * Recomputes the stored card price (`price_from`) of the matching products.
 * Unavailable values are ignored, as on the storefront.
 */
export async function refreshPriceFrom(
  executor: DatabaseExecutor,
  where: SQL,
): Promise<void> {
  const rows = await executor.query.products.findMany({
    where,
    columns: {
      id: true,
      basePrice: true,
      priceFrom: true,
      weightGrams: true,
      productionDaysMin: true,
      productionDaysMax: true,
    },
    with: PRICING_RELATIONS,
  });

  for (const row of rows) {
    const price = priceFrom({
      ...row,
      optionGroups: row.optionGroups.map((group) => ({
        ...group,
        values: group.values.filter((value) => value.isAvailable),
      })),
    });

    if (price !== row.priceFrom) {
      await executor
        .update(products)
        .set({ priceFrom: price })
        .where(eq(products.id, row.id));
    }
  }
}

/** Products offering the metal in any option value. */
export function productsWithMetal(executor: DatabaseExecutor, metalId: string) {
  return inArray(
    products.id,
    executor
      .select({ id: optionGroups.productId })
      .from(optionValues)
      .innerJoin(optionGroups, eq(optionGroups.id, optionValues.groupId))
      .where(eq(optionValues.metalId, metalId)),
  );
}
