import { index, integer, jsonb, real, text, uuid } from 'drizzle-orm/pg-core';
import { productType } from './catalog.schema';
import { appSchema, ImageAsset, timestamps } from './common.schema';
import { customers } from './customers.schema';
import { orders } from './orders.schema';

export const CUSTOM_REQUEST_STATUSES = [
  'new',
  'in_review',
  'quoted',
  'accepted',
  'declined',
  'rejected',
] as const;
export type CustomRequestStatus = (typeof CUSTOM_REQUEST_STATUSES)[number];

export const customRequestStatus = appSchema.enum(
  'custom_request_status',
  CUSTOM_REQUEST_STATUSES,
);

export const customRequests = appSchema.table(
  'custom_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    status: customRequestStatus('status').notNull().default('new'),
    productType: productType('product_type').notNull(),
    description: text('description').notNull(),
    referenceImages: jsonb('reference_images')
      .$type<ImageAsset[]>()
      .notNull()
      .default([]),
    budgetMin: integer('budget_min'),
    budgetMax: integer('budget_max'),
    desiredMetal: text('desired_metal'),
    ringSize: real('ring_size'),
    quoteTitle: text('quote_title'),
    quotePrice: integer('quote_price'),
    quoteDepositAmount: integer('quote_deposit_amount'),
    quoteProductionDaysMin: integer('quote_production_days_min'),
    quoteProductionDaysMax: integer('quote_production_days_max'),
    quoteNote: text('quote_note'),
    adminNote: text('admin_note'),
    orderId: uuid('order_id').references(() => orders.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    index('custom_requests_customer_idx').on(table.customerId),
    index('custom_requests_status_idx').on(table.status),
  ],
);

export type CustomRequest = typeof customRequests.$inferSelect;
