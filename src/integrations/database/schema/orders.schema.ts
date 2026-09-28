import {
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { products } from './catalog.schema';
import { appSchema, timestamps } from './common.schema';
import type { JewelrySpecification } from './common.schema';
import { customers } from './customers.schema';

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'awaiting_model_payment',
  'modeling',
  'model_review',
  'awaiting_production_payment',
  'in_production',
  'awaiting_final_payment',
  'ready',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_KINDS = ['catalog', 'custom'] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

export const PAYMENT_TYPES = [
  'full',
  'deposit',
  'model_prepayment',
  'production_prepayment',
  'remainder',
  'manual',
] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'success',
  'failure',
  'reversed',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const orderStatus = appSchema.enum('order_status', ORDER_STATUSES);
export const orderKind = appSchema.enum('order_kind', ORDER_KINDS);
export const paymentType = appSchema.enum('payment_type', PAYMENT_TYPES);
export const paymentStatus = appSchema.enum('payment_status', PAYMENT_STATUSES);

export interface SelectedOption {
  groupId: string;
  groupName: string;
  kind: string;
  valueId: string;
  label: string;
  priceDelta: number;
}

export const favorites = appSchema.table(
  'favorites',
  {
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.customerId, table.productId] })],
);

export const cartItems = appSchema.table(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    optionValueIds: jsonb('option_value_ids')
      .$type<string[]>()
      .notNull()
      .default([]),
    engravingText: text('engraving_text'),
    quantity: integer('quantity').notNull().default(1),
    ...timestamps,
  },
  (table) => [index('cart_items_customer_idx').on(table.customerId)],
);

export const orders = appSchema.table(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: integer('number')
      .notNull()
      .unique()
      .generatedAlwaysAsIdentity({ startWith: 1001 }),
    kind: orderKind('kind').notNull(),
    status: orderStatus('status').notNull().default('pending_payment'),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    contactName: text('contact_name').notNull(),
    contactPhone: text('contact_phone').notNull(),
    contactEmail: text('contact_email'),
    deliveryCityRef: text('delivery_city_ref').notNull(),
    deliveryCityName: text('delivery_city_name').notNull(),
    deliveryWarehouseRef: text('delivery_warehouse_ref').notNull(),
    deliveryWarehouseName: text('delivery_warehouse_name').notNull(),
    trackingNumber: text('tracking_number'),
    subtotal: integer('subtotal').notNull(),
    discount: integer('discount').notNull().default(0),
    total: integer('total').notNull(),
    /** Legacy custom orders: first payment before production. */
    depositAmount: integer('deposit_amount'),
    /** Staged custom orders: 3D model prepayment, paid first. */
    modelPaymentAmount: integer('model_payment_amount'),
    /** Staged custom orders: prepayment due before manufacturing. */
    productionPaymentAmount: integer('production_payment_amount'),
    paidAmount: integer('paid_amount').notNull().default(0),
    productionDaysMin: integer('production_days_min').notNull().default(0),
    productionDaysMax: integer('production_days_max').notNull().default(0),
    customerComment: text('customer_comment'),
    adminNote: text('admin_note'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('orders_customer_idx').on(table.customerId),
    index('orders_status_idx').on(table.status),
  ],
);

export const orderItems = appSchema.table(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    productSlug: text('product_slug'),
    productName: text('product_name').notNull(),
    imageUrl: text('image_url'),
    selectedOptions: jsonb('selected_options')
      .$type<SelectedOption[]>()
      .notNull()
      .default([]),
    engravingText: text('engraving_text'),
    /** Approved proposal specification of a custom piece. */
    specification: jsonb('specification').$type<JewelrySpecification>(),
    /** Taken from ready stock; returned to stock if the order is cancelled. */
    fromStock: boolean('from_stock').notNull().default(false),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
    discount: integer('discount').notNull().default(0),
    lineTotal: integer('line_total').notNull(),
    productionDaysMin: integer('production_days_min').notNull().default(0),
    productionDaysMax: integer('production_days_max').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('order_items_order_idx').on(table.orderId)],
);

export const orderStatusHistory = appSchema.table(
  'order_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatus('from_status'),
    toStatus: orderStatus('to_status').notNull(),
    note: text('note'),
    changedBy: uuid('changed_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('order_status_history_order_idx').on(table.orderId)],
);

export const payments = appSchema.table(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    type: paymentType('type').notNull(),
    status: paymentStatus('status').notNull().default('pending'),
    amount: integer('amount').notNull(),
    providerPaymentId: text('provider_payment_id'),
    providerStatus: text('provider_status'),
    rawCallback: jsonb('raw_callback').$type<Record<string, unknown>>(),
    note: text('note'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index('payments_order_idx').on(table.orderId)],
);

export type CartItem = typeof cartItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderStatusChange = typeof orderStatusHistory.$inferSelect;
export type Payment = typeof payments.$inferSelect;
