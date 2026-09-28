import { sql } from 'drizzle-orm';
import { check, index, jsonb, text, uuid } from 'drizzle-orm/pg-core';
import { appSchema, ImageAsset, timestamps } from './common.schema';
import { customRequests } from './custom.requests.schema';
import { orders } from './orders.schema';
import { productionStages } from './production.schema';

export const MESSAGE_AUTHOR_ROLES = ['customer', 'staff'] as const;
export type MessageAuthorRole = (typeof MESSAGE_AUTHOR_ROLES)[number];

export const messageAuthorRole = appSchema.enum(
  'message_author_role',
  MESSAGE_AUTHOR_ROLES,
);

/** Conversation between a customer and the workshop about one order or request. */
export const messages = appSchema.table(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').references(() => orders.id, {
      onDelete: 'cascade',
    }),
    customRequestId: uuid('custom_request_id').references(
      () => customRequests.id,
      { onDelete: 'cascade' },
    ),
    authorId: uuid('author_id').notNull(),
    authorRole: messageAuthorRole('author_role').notNull(),
    body: text('body').notNull().default(''),
    attachments: jsonb('attachments')
      .$type<ImageAsset[]>()
      .notNull()
      .default([]),
    stageId: uuid('stage_id').references(() => productionStages.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    index('messages_order_idx').on(table.orderId),
    index('messages_custom_request_idx').on(table.customRequestId),
    check(
      'messages_single_thread',
      sql`(${table.orderId} is null) <> (${table.customRequestId} is null)`,
    ),
  ],
);

export type Message = typeof messages.$inferSelect;
