import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  designCandidates,
  products,
} from '../../integrations/database/database.schema';
import { qualified } from '../../integrations/database/database.sql';

/** `true` when the product was made from an imported open-license design. */
export const isOpenModel = sql<boolean>`exists (select 1 from ${designCandidates} where ${qualified(designCandidates.productId)} = ${qualified(products.id)})`;

/** Popularity of the source design; `null` for our own products. */
export const openModelPopularity = sql<
  number | null
>`(select ${qualified(designCandidates.popularityScore)} from ${designCandidates} where ${qualified(designCandidates.productId)} = ${qualified(products.id)})`;

/**
 * Every storefront listing shows our own products first; products made from
 * open-license designs always follow, whatever the requested sort.
 */
export function ownProductsFirst(order: SQL[]): SQL[] {
  return [sql`${isOpenModel} asc`, ...order];
}

/** Open models by popularity, own products by their manual position. */
export function positionOrder(): SQL[] {
  return [
    sql`${openModelPopularity} desc nulls last`,
    sql`${products.sortOrder} asc`,
    sql`${products.publishedAt} desc nulls last`,
  ];
}

export function defaultProductOrder(): SQL[] {
  return ownProductsFirst(positionOrder());
}
