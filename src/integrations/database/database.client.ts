import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './database.schema';

export type DatabaseSchema = typeof schema;
export type Database = PgDatabase<PgQueryResultHKT, DatabaseSchema>;
export type DatabaseTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];
/** Either the root client or an open transaction. */
export type DatabaseExecutor = Database | DatabaseTransaction;

export const DATABASE = Symbol('DATABASE');
export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');
