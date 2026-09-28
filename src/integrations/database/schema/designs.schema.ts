import {
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { products, productType } from './catalog.schema';
import { appSchema, timestamps } from './common.schema';

export const DESIGN_SOURCES = ['sketchfab'] as const;
export type DesignSource = (typeof DESIGN_SOURCES)[number];

/** Only licenses that allow commercial manufacturing are ever stored. */
export const DESIGN_LICENSES = ['cc0', 'cc_by'] as const;
export type DesignLicense = (typeof DESIGN_LICENSES)[number];

export const DESIGN_IP_RISKS = ['low', 'review', 'blocked'] as const;
export type DesignIpRisk = (typeof DESIGN_IP_RISKS)[number];

export const DESIGN_STATUSES = ['candidate', 'approved', 'rejected'] as const;
export type DesignStatus = (typeof DESIGN_STATUSES)[number];

export const designSource = appSchema.enum('design_source', DESIGN_SOURCES);
export const designLicense = appSchema.enum('design_license', DESIGN_LICENSES);
export const designIpRisk = appSchema.enum('design_ip_risk', DESIGN_IP_RISKS);
export const designStatus = appSchema.enum('design_status', DESIGN_STATUSES);

export const designCandidates = appSchema.table(
  'design_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: designSource('source').notNull(),
    sourceId: text('source_id').notNull(),
    sourceUrl: text('source_url').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    authorName: text('author_name').notNull(),
    authorUrl: text('author_url'),
    license: designLicense('license').notNull(),
    licenseUrl: text('license_url').notNull(),
    previewUrl: text('preview_url'),
    embedUrl: text('embed_url'),
    likes: integer('likes').notNull().default(0),
    views: integer('views').notNull().default(0),
    sourcePublishedAt: timestamp('source_published_at', {
      withTimezone: true,
    }),
    suggestedType: productType('suggested_type'),
    relevanceScore: integer('relevance_score').notNull().default(0),
    popularityScore: integer('popularity_score').notNull().default(0),
    ipRisk: designIpRisk('ip_risk').notNull().default('low'),
    ipMatches: jsonb('ip_matches').$type<string[]>().notNull().default([]),
    status: designStatus('status').notNull().default('candidate'),
    productId: uuid('product_id')
      .unique()
      .references(() => products.id, { onDelete: 'set null' }),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('design_candidates_source_idx').on(
      table.source,
      table.sourceId,
    ),
    index('design_candidates_status_idx').on(table.status),
    index('design_candidates_score_idx').on(table.popularityScore),
  ],
);

export type DesignCandidate = typeof designCandidates.$inferSelect;
export type NewDesignCandidate = typeof designCandidates.$inferInsert;
