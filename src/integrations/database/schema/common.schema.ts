import { pgSchema, timestamp } from 'drizzle-orm/pg-core';
import type { ProductType } from './catalog.schema';

/**
 * Application tables live outside `public` so the Supabase Data API, which
 * is reachable with the publishable key, never exposes them.
 */
export const appSchema = pgSchema('app');

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export interface ImageAsset {
  publicId: string;
  url: string;
  alt?: string;
}

export const SPECIFICATION_MODES = ['specified', 'recommend', 'none'] as const;
export type SpecificationMode = (typeof SPECIFICATION_MODES)[number];

/** A reference-data choice; `name` is a snapshot so later renames never rewrite history. */
export interface SpecificationChoice {
  id: string | null;
  name: string;
}

export interface SpecificationStone {
  gemstoneId: string | null;
  name: string;
  sizeMm: number | null;
  quantity: number;
  notes: string | null;
}

/**
 * Structured description of a bespoke piece. The same shape describes what a
 * customer asked for and what the workshop proposed.
 */
export interface JewelrySpecification {
  productType: ProductType;
  /** `recommend`: the customer asks the workshop to choose. */
  metalMode: Exclude<SpecificationMode, 'none'>;
  metal: SpecificationChoice | null;
  weightGrams: number | null;
  /** Ring size or length in cm, depending on the product type. */
  size: number | null;
  stoneMode: SpecificationMode;
  stones: SpecificationStone[];
  engraving: (SpecificationChoice & { text: string | null }) | null;
  coating: SpecificationChoice | null;
  processing: SpecificationChoice[];
  timeline: string | null;
  comments: string | null;
  requirements: string | null;
  /** Additional agreed parameters, e.g. `Ширина шинки: 2 мм`. */
  extras: Array<{ label: string; value: string }>;
}
