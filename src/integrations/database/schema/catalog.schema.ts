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
  'chain',
  'bracelet',
  'brooch',
  'cufflinks',
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
  'coating',
  'processing',
  'custom',
] as const;
export type OptionGroupKind = (typeof OPTION_GROUP_KINDS)[number];

export const METAL_FAMILIES = [
  'gold',
  'silver',
  'platinum',
  'palladium',
  'other',
] as const;
export type MetalFamily = (typeof METAL_FAMILIES)[number];

/** Manufacturing operations offered as product options and in requests. */
export const FINISHING_KINDS = ['engraving', 'coating', 'processing'] as const;
export type FinishingKind = (typeof FINISHING_KINDS)[number];

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
export const metalFamily = appSchema.enum('metal_family', METAL_FAMILIES);
export const finishingKind = appSchema.enum('finishing_kind', FINISHING_KINDS);

export interface ProductSpecification {
  label: string;
  value: string;
}

export const metals = appSchema.table('metals', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  family: metalFamily('family').notNull().default('other'),
  purity: text('purity'),
  color: text('color'),
  /** Kopiykas per gram; `null` leaves the metal out of automatic pricing. */
  pricePerGram: integer('price_per_gram'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const finishingOptions = appSchema.table('finishing_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  kind: finishingKind('kind').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  /** Suggested surcharge in kopiykas when the option is added to a product. */
  defaultPrice: integer('default_price').notNull().default(0),
  productionDays: integer('production_days').notNull().default(0),
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
    /** Manufacturing (labour) price in kopiykas, before metal and stones. */
    basePrice: integer('base_price').notNull(),
    /** Price of the default configuration; recomputed on every price change. */
    priceFrom: integer('price_from').notNull().default(0),
    /** Approximate metal weight of the default size, in grams. */
    weightGrams: real('weight_grams'),
    widthMm: real('width_mm'),
    heightMm: real('height_mm'),
    productionDaysMin: integer('production_days_min').notNull().default(0),
    productionDaysMax: integer('production_days_max').notNull().default(0),
    availability: productAvailability('availability')
      .notNull()
      .default('made_to_order'),
    stockQuantity: integer('stock_quantity').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    collectionSortOrder: integer('collection_sort_order').notNull().default(0),
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
    finishingId: uuid('finishing_id').references(() => finishingOptions.id, {
      onDelete: 'restrict',
    }),
    stoneCarat: real('stone_carat'),
    stoneSizeMm: real('stone_size_mm'),
    /** Ring size or length in cm, depending on the product type. */
    sizeValue: real('size_value'),
    /** Extra metal in grams when the value is selected (e.g. a larger size). */
    weightDeltaGrams: real('weight_delta_grams').notNull().default(0),
    priceDelta: integer('price_delta').notNull().default(0),
    productionDaysDelta: integer('production_days_delta').notNull().default(0),
    isDefault: boolean('is_default').notNull().default(false),
    isAvailable: boolean('is_available').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [index('option_values_group_idx').on(table.groupId)],
);

/** Fixed stone composition of a product, e.g. 5 × cubic zirconia 1.5 mm. */
export const productStones = appSchema.table(
  'product_stones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    gemstoneId: uuid('gemstone_id')
      .notNull()
      .references(() => gemstones.id, { onDelete: 'restrict' }),
    /** Quality, cut, or colour grade. */
    variation: text('variation'),
    sizeMm: real('size_mm'),
    carat: real('carat'),
    quantity: integer('quantity').notNull().default(1),
    /** Kopiykas per stone, setting included. */
    unitPrice: integer('unit_price').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [index('product_stones_product_idx').on(table.productId)],
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
export type FinishingOption = typeof finishingOptions.$inferSelect;
export type ProductStone = typeof productStones.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Collection = typeof collections.$inferSelect;
export type Product = typeof products.$inferSelect;
export type OptionGroup = typeof optionGroups.$inferSelect;
export type OptionValue = typeof optionValues.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
