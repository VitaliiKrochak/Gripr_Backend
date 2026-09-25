import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { appSchema, ImageAsset, timestamps } from './common.schema';
import { orderItems } from './orders.schema';

export const PRODUCTION_STEP_STATES = [
  'pending',
  'in_progress',
  'done',
  'skipped',
] as const;
export type ProductionStepState = (typeof PRODUCTION_STEP_STATES)[number];

export const productionStepState = appSchema.enum(
  'production_step_state',
  PRODUCTION_STEP_STATES,
);

export const productionStages = appSchema.table('production_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  defaultForCatalog: boolean('default_for_catalog').notNull().default(false),
  defaultForCustom: boolean('default_for_custom').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const productionSteps = appSchema.table(
  'production_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderItemId: uuid('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => productionStages.id, { onDelete: 'restrict' }),
    state: productionStepState('state').notNull().default('pending'),
    sortOrder: integer('sort_order').notNull().default(0),
    note: text('note'),
    images: jsonb('images').$type<ImageAsset[]>().notNull().default([]),
    visibleToCustomer: boolean('visible_to_customer').notNull().default(true),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('production_steps_item_idx').on(table.orderItemId),
    unique('production_steps_item_stage_unique').on(
      table.orderItemId,
      table.stageId,
    ),
  ],
);

export type ProductionStage = typeof productionStages.$inferSelect;
export type ProductionStep = typeof productionSteps.$inferSelect;
