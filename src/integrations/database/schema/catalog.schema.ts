import {
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { appSchema, ImageAsset, timestamps } from './common.schema';

export const PUBLICATION_STATUSES = ['draft', 'published', 'archived'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const PRODUCT_TYPES = [
  'ring',
  'earrings',
  'pendant',
  'necklace',
  'bracelet',
  'brooch',
  'other',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_AVAILABILITIES = ['in_stock', 'made_to_order'] as const;
export type ProductAvailability = (typeof PRODUCT_AVAILABILITIES)[number];

export const OPTION_GROUP_KINDS = [
  'metal',
  'stone',
  'size',
  'engraving',
  'custom',
] as const;
export type OptionGroupKind = (typeof OPTION_GROUP_KINDS)[number];

export const publicationStatus = appSchema.enum(
  'publication_status',
  PUBLICATION_STATUSES,
);
export const productType = appSchema.enum('product_type', PRODUCT_TYPES);
export const productAvailability = appSchema.enum(
  'product_availability',
  PRODUCT_AVAILABILITIES,
);
export const optionGroupKind = appSchema.enum(
  'option_group_kind',
  OPTION_GROUP_KINDS,
);

export interface ProductSpecification {
  label: string;
  value: string;
}

export const metals = appSchema.table('metals', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  purity: text('purity'),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const gemstones = appSchema.table('gemstones', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  color: text('color'),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const tags = appSchema.table('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  group: text('group'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

export const collections = appSchema.table(
  'collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    subtitle: text('subtitle'),
    description: text('description'),
    coverImage: jsonb('cover_image').$type<ImageAsset>(),
    gallery: jsonb('gallery').$type<ImageAsset[]>().notNull().default([]),
    status: publicationStatus('status').notNull().default('draft'),
    isFeatured: boolean('is_featured').notNull().default(false),
    isSet: boolean('is_set').notNull().default(false),
    setDiscountPercent: integer('set_discount_percent').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index('collections_status_idx').on(table.status)],
);

export const products = appSchema.table(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    type: productType('type').notNull(),
    shortDescription: text('short_description'),
    description: text('description'),
    specifications: jsonb('specifications')
      .$type<ProductSpecification[]>()
      .notNull()
      .default([]),
    collectionId: uuid('collection_id').references(() => collections.id, {
      onDelete: 'set null',
    }),
    status: publicationStatus('status').notNull().default('draft'),
    isHot: boolean('is_hot').notNull().default(false),
    isNew: boolean('is_new').notNull().default(false),
    isFeatured: boolean('is_featured').notNull().default(false),
    basePrice: integer('base_price').notNull(),
    productionDaysMin: integer('production_days_min').notNull().default(0),
    productionDaysMax: integer('production_days_max').notNull().default(0),
    availability: productAvailability('availability')
      .notNull()
      .default('made_to_order'),
    stockQuantity: integer('stock_quantity').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('products_status_idx').on(table.status),
    index('products_collection_idx').on(table.collectionId),
  ],
);

export const productTags = appSchema.table(
  'product_tags',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.productId, table.tagId] })],
);

export const optionGroups = appSchema.table(
  'option_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    kind: optionGroupKind('kind').notNull(),
    name: text('name').notNull(),
    isRequired: boolean('is_required').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [index('option_groups_product_idx').on(table.productId)],
);

export const optionValues = appSchema.table(
  'option_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => optionGroups.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    metalId: uuid('metal_id').references(() => metals.id, {
      onDelete: 'restrict',
    }),
    gemstoneId: uuid('gemstone_id').references(() => gemstones.id, {
      onDelete: 'restrict',
    }),
    stoneCarat: real('stone_carat'),
    stoneSizeMm: real('stone_size_mm'),
    ringSize: real('ring_size'),
    priceDelta: integer('price_delta').notNull().default(0),
    productionDaysDelta: integer('production_days_delta').notNull().default(0),
    isDefault: boolean('is_default').notNull().default(false),
    isAvailable: boolean('is_available').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [index('option_values_group_idx').on(table.groupId)],
);

export const productImages = appSchema.table(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    publicId: text('public_id').notNull(),
    url: text('url').notNull(),
    alt: text('alt'),
    optionValueId: uuid('option_value_id').references(() => optionValues.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [index('product_images_product_idx').on(table.productId)],
);

export type Metal = typeof metals.$inferSelect;
export type Gemstone = typeof gemstones.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Collection = typeof collections.$inferSelect;
export type Product = typeof products.$inferSelect;
export type OptionGroup = typeof optionGroups.$inferSelect;
export type OptionValue = typeof optionValues.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
