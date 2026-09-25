import { real, text, uuid } from 'drizzle-orm/pg-core';
import { appSchema, timestamps } from './common.schema';

/** `id` is the Supabase Auth user id. */
export const customers = appSchema.table('customers', {
  id: uuid('id').primaryKey(),
  phone: text('phone'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  ringSize: real('ring_size'),
  deliveryCityRef: text('delivery_city_ref'),
  deliveryCityName: text('delivery_city_name'),
  deliveryWarehouseRef: text('delivery_warehouse_ref'),
  deliveryWarehouseName: text('delivery_warehouse_name'),
  ...timestamps,
});

export type Customer = typeof customers.$inferSelect;
