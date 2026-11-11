import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { MeshWarning } from '../../../modules/prints/mesh/mesh.analysis';
import type {
  MeshPart,
  MeshSize,
} from '../../../modules/prints/mesh/mesh.measure';
import { products } from './catalog.schema';
import { appSchema, timestamps } from './common.schema';
import { customers } from './customers.schema';
import { orders } from './orders.schema';

export const PRINT_FILE_STATUSES = [
  /** Waiting for the browser to upload to the signed URL. */
  'uploading',
  'analyzing',
  'analyzed',
  /** Accepted but not measured automatically (STEP); staff measure it. */
  'manual',
  'failed',
] as const;
export type PrintFileStatus = (typeof PRINT_FILE_STATUSES)[number];

export const printFileStatus = appSchema.enum(
  'print_file_status',
  PRINT_FILE_STATUSES,
);

/**
 * Gripr Lab model files in the private Storage bucket, owned by a customer, a
 * product, or an order (a modeled file delivered to the customer). When the
 * owner is deleted the row loses it and the nightly cleanup removes the file.
 */
export const printFiles = appSchema.table(
  'print_files',
  {
    id: uuid('id').primaryKey(),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    orderId: uuid('order_id').references(() => orders.id, {
      onDelete: 'set null',
    }),
    fileName: text('file_name').notNull(),
    extension: text('extension').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storagePath: text('storage_path').notNull().unique(),
    status: printFileStatus('status').notNull().default('uploading'),
    error: text('error'),
    volumeMl: doublePrecision('volume_ml'),
    sizeMm: jsonb('size_mm').$type<MeshSize>(),
    triangles: integer('triangles'),
    isWatertight: boolean('is_watertight'),
    /** The 3MF unit; `null` when the format has none (millimetres assumed). */
    units: text('units'),
    parts: jsonb('parts').$type<MeshPart[]>(),
    warnings: jsonb('warnings').$type<MeshWarning[]>().notNull().default([]),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    analyzedAt: timestamp('analyzed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    check(
      'print_files_one_owner',
      sql`num_nonnulls(${table.customerId}, ${table.productId}, ${table.orderId}) <= 1`,
    ),
    index('print_files_customer_idx').on(table.customerId),
    index('print_files_product_idx').on(table.productId),
    index('print_files_order_idx').on(table.orderId),
  ],
);

export type PrintFile = typeof printFiles.$inferSelect;
