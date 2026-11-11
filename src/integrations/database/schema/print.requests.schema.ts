import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  PrintCalculation,
  PrintOverrides,
} from '../../../modules/prints/print.pricing';
import type { PrintBase } from '../../../modules/prints/print.settings';
import { appSchema, timestamps } from './common.schema';
import { customers } from './customers.schema';
import { orders } from './orders.schema';
import { printFiles } from './print.files.schema';
import { printers, printFinish, resins } from './prints.schema';

export const PRINT_REQUEST_STATUSES = [
  'draft',
  'submitted',
  'in_review',
  'changes_requested',
  'confirmed',
  'in_cart',
  'ordered',
  'rejected',
  'cancelled',
] as const;
export type PrintRequestStatus = (typeof PRINT_REQUEST_STATUSES)[number];

export const printRequestStatus = appSchema.enum(
  'print_request_status',
  PRINT_REQUEST_STATUSES,
);

/** A customer's request to print their own models in Gripr Lab. */
export const printRequests = appSchema.table(
  'print_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    status: printRequestStatus('status').notNull().default('draft'),
    comment: text('comment'),
    /** The customer confirmed they may have the models printed. */
    rightsConfirmed: boolean('rights_confirmed').notNull().default(false),
    /** Kopiykas; `null` while some item cannot be priced automatically. */
    estimate: integer('estimate'),
    /** Kopiykas, set by staff; valid for 14 days after `confirmedAt`. */
    confirmedPrice: integer('confirmed_price'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    /** Shown to the customer: what to change or why it was rejected. */
    staffNote: text('staff_note'),
    productionDaysMin: integer('production_days_min'),
    productionDaysMax: integer('production_days_max'),
    orderId: uuid('order_id').references(() => orders.id, {
      onDelete: 'set null',
    }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('print_requests_customer_idx').on(table.customerId),
    index('print_requests_status_idx').on(table.status),
    index('print_requests_order_idx').on(table.orderId),
  ],
);

/** One model of a print request with the customer's choices and its price. */
export const printRequestItems = appSchema.table(
  'print_request_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => printRequests.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    /** `null` once the file was deleted; `fileName` keeps the history. */
    fileId: uuid('file_id').references(() => printFiles.id, {
      onDelete: 'set null',
    }),
    fileName: text('file_name').notNull(),
    quantity: integer('quantity').notNull().default(1),
    heightMm: doublePrecision('height_mm'),
    scaleFactor: doublePrecision('scale_factor'),
    resinId: uuid('resin_id').references(() => resins.id, {
      onDelete: 'restrict',
    }),
    finish: printFinish('finish').notNull().default('supports_removed'),
    painted: boolean('painted').notNull().default(false),
    /** Snapshot of the chosen base from the print settings. */
    base: jsonb('base').$type<PrintBase>(),
    /** Staff: printer to price on; `null` is the default printer. */
    printerId: uuid('printer_id').references(() => printers.id, {
      onDelete: 'set null',
    }),
    /** Staff: painting multiplier, e.g. × 3 for a complex model. */
    paintingMultiplier: doublePrecision('painting_multiplier'),
    /** Staff: slicer values at the printed size. */
    overrides: jsonb('overrides').$type<PrintOverrides>(),
    /** Kopiykas; `null` while the item cannot be priced. */
    unitPrice: integer('unit_price'),
    lineTotal: integer('line_total'),
    /** Why the item has no price, e.g. the file is measured by staff. */
    priceError: text('price_error'),
    calculation: jsonb('calculation').$type<PrintCalculation>(),
    ...timestamps,
  },
  (table) => [index('print_request_items_request_idx').on(table.requestId)],
);

export type PrintRequest = typeof printRequests.$inferSelect;
export type PrintRequestItem = typeof printRequestItems.$inferSelect;
