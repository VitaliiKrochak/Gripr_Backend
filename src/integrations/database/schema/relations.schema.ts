import { relations } from 'drizzle-orm';
import {
  collections,
  gemstones,
  metals,
  optionGroups,
  optionValues,
  productImages,
  products,
  productTags,
  tags,
} from './catalog.schema';
import { customRequests } from './custom.requests.schema';
import { customers } from './customers.schema';
import { designCandidates } from './designs.schema';
import {
  cartItems,
  orderItems,
  orders,
  orderStatusHistory,
  payments,
} from './orders.schema';
import { productionStages, productionSteps } from './production.schema';

export const collectionsRelations = relations(collections, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  collection: one(collections, {
    fields: [products.collectionId],
    references: [collections.id],
  }),
  images: many(productImages),
  optionGroups: many(optionGroups),
  productTags: many(productTags),
  designCandidate: one(designCandidates, {
    fields: [products.id],
    references: [designCandidates.productId],
  }),
}));

export const designCandidatesRelations = relations(
  designCandidates,
  ({ one }) => ({
    product: one(products, {
      fields: [designCandidates.productId],
      references: [products.id],
    }),
  }),
);

export const productTagsRelations = relations(productTags, ({ one }) => ({
  product: one(products, {
    fields: [productTags.productId],
    references: [products.id],
  }),
  tag: one(tags, { fields: [productTags.tagId], references: [tags.id] }),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const optionGroupsRelations = relations(
  optionGroups,
  ({ one, many }) => ({
    product: one(products, {
      fields: [optionGroups.productId],
      references: [products.id],
    }),
    values: many(optionValues),
  }),
);

export const optionValuesRelations = relations(optionValues, ({ one }) => ({
  group: one(optionGroups, {
    fields: [optionValues.groupId],
    references: [optionGroups.id],
  }),
  metal: one(metals, {
    fields: [optionValues.metalId],
    references: [metals.id],
  }),
  gemstone: one(gemstones, {
    fields: [optionValues.gemstoneId],
    references: [gemstones.id],
  }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  history: many(orderStatusHistory),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  productionSteps: many(productionSteps),
}));

export const orderStatusHistoryRelations = relations(
  orderStatusHistory,
  ({ one }) => ({
    order: one(orders, {
      fields: [orderStatusHistory.orderId],
      references: [orders.id],
    }),
  }),
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const productionStepsRelations = relations(
  productionSteps,
  ({ one }) => ({
    orderItem: one(orderItems, {
      fields: [productionSteps.orderItemId],
      references: [orderItems.id],
    }),
    stage: one(productionStages, {
      fields: [productionSteps.stageId],
      references: [productionStages.id],
    }),
  }),
);

export const customRequestsRelations = relations(customRequests, ({ one }) => ({
  customer: one(customers, {
    fields: [customRequests.customerId],
    references: [customers.id],
  }),
  order: one(orders, {
    fields: [customRequests.orderId],
    references: [orders.id],
  }),
}));
