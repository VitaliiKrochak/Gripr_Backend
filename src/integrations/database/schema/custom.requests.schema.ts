import {
  boolean,
  index,
  integer,
  jsonb,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { products, productType } from './catalog.schema';
import { appSchema, ImageAsset, timestamps } from './common.schema';
import type { JewelrySpecification } from './common.schema';
import { customers } from './customers.schema';
import { orders, SelectedOption } from './orders.schema';

/**
 * `quoted` means a proposal was sent and `accepted` that it was approved;
 * the names predate proposals and are kept for existing rows.
 */
export const CUSTOM_REQUEST_STATUSES = [
  'new',
  'in_review',
  'quoted',
  'changes_requested',
  'accepted',
  'declined',
  'rejected',
] as const;
export type CustomRequestStatus = (typeof CUSTOM_REQUEST_STATUSES)[number];

export const CUSTOM_REQUEST_SOURCES = ['custom', 'customization'] as const;
export type CustomRequestSource = (typeof CUSTOM_REQUEST_SOURCES)[number];

export const PROPOSAL_STATUSES = [
  'sent',
  'approved',
  'changes_requested',
  'superseded',
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const customRequestStatus = appSchema.enum(
  'custom_request_status',
  CUSTOM_REQUEST_STATUSES,
);
export const customRequestSource = appSchema.enum(
  'custom_request_source',
  CUSTOM_REQUEST_SOURCES,
);
export const proposalStatus = appSchema.enum(
  'proposal_status',
  PROPOSAL_STATUSES,
);

export const customRequests = appSchema.table(
  'custom_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    status: customRequestStatus('status').notNull().default('new'),
    source: customRequestSource('source').notNull().default('custom'),
    /** Catalog product the customer wants to modify. */
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    productName: text('product_name'),
    productSlug: text('product_slug'),
    baseOptions: jsonb('base_options')
      .$type<SelectedOption[]>()
      .notNull()
      .default([]),
    productType: productType('product_type').notNull(),
    description: text('description').notNull(),
    referenceImages: jsonb('reference_images')
      .$type<ImageAsset[]>()
      .notNull()
      .default([]),
    budgetMin: integer('budget_min'),
    budgetMax: integer('budget_max'),
    /** Original structured request; never changed after submission. */
    specification: jsonb('specification').$type<JewelrySpecification>(),
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

/** Versioned workshop offer; the latest `sent` version can be approved. */
export const customProposals = appSchema.table(
  'custom_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => customRequests.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    status: proposalStatus('status').notNull().default('sent'),
    title: text('title').notNull(),
    specification: jsonb('specification')
      .$type<JewelrySpecification>()
      .notNull(),
    requiresModel: boolean('requires_model').notNull().default(true),
    /** 3D modeling price in kopiykas, paid as the first prepayment. */
    modelPrice: integer('model_price').notNull().default(0),
    /** Price of the physical piece in kopiykas. */
    productPrice: integer('product_price').notNull(),
    /** Part of the product price due before manufacturing starts. */
    productionPrepayment: integer('production_prepayment').notNull(),
    productionDaysMin: integer('production_days_min').notNull(),
    productionDaysMax: integer('production_days_max').notNull(),
    note: text('note'),
    customerResponse: text('customer_response'),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
    ...timestamps,
  },
  (table) => [
    unique('custom_proposals_request_version_unique').on(
      table.requestId,
      table.version,
    ),
  ],
);

export type CustomRequest = typeof customRequests.$inferSelect;
export type CustomProposal = typeof customProposals.$inferSelect;
