import { getTableName, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * Renders `"table"."column"`. Drizzle omits the table name in single-table
 * queries, which makes correlated subqueries bind to the wrong table; use
 * this for every column referenced inside a raw subquery.
 */
export function qualified(column: AnyPgColumn): SQL {
  return sql.raw(`"${getTableName(column.table)}"."${column.name}"`);
}
