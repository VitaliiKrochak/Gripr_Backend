import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../integrations/database/database.client';
import {
  optionGroups,
  optionValues,
  products,
} from '../../integrations/database/database.schema';
import { printContextFor, withPrintPricing } from '../prints/print.context';
import { priceFrom } from './product.configuration';

/** Lab products priced by the print calculator. */
export const printPriced = sql`${products.print}->>'mode' = 'auto'`;

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
 * Unavailable values are ignored, as on the storefront. Print-priced
 * products also take their production time from the print settings.
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
      print: true,
    },
    with: PRICING_RELATIONS,
  });
  const printContext = await printContextFor(executor, rows);

  for (const row of rows) {
    const product = withPrintPricing(
      {
        ...row,
        optionGroups: row.optionGroups.map((group) => ({
          ...group,
          values: group.values.filter((value) => value.isAvailable),
        })),
      },
      printContext,
    );
    const changes: Partial<typeof products.$inferInsert> = {};
    const price = priceFrom(product);

    if (price !== row.priceFrom) {
      changes.priceFrom = price;
    }

    if (product.productionDaysMin !== row.productionDaysMin) {
      changes.productionDaysMin = product.productionDaysMin;
    }

    if (product.productionDaysMax !== row.productionDaysMax) {
      changes.productionDaysMax = product.productionDaysMax;
    }

    if (Object.keys(changes).length) {
      await executor
        .update(products)
        .set(changes)
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
