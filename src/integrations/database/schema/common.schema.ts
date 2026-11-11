import { pgSchema, timestamp } from 'drizzle-orm/pg-core';
import type { PrintFinish } from '../../../modules/prints/print.settings';
import type { JewelryProductType } from './catalog.schema';

/**
 * Application tables live outside `public` so the Supabase Data API, which
 * is reachable with the publishable key, never exposes them.
 */
export const appSchema = pgSchema('app');

/** `gripr` sells jewelry; `lab` sells resin-printed figurines and models. */
export const STORES = ['gripr', 'lab'] as const;
export type Store = (typeof STORES)[number];

export const storeEnum = appSchema.enum('store', STORES);

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
  productType: JewelryProductType;
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

/** What a Gripr Lab modeling order delivers: a printed piece, the file, or both. */
export const MODEL_DELIVERABLES = ['print', 'file', 'print_and_file'] as const;
export type ModelDeliverable = (typeof MODEL_DELIVERABLES)[number];

/**
 * A Gripr Lab model we design: what is delivered and, for printed pieces,
 * how they are printed. Names are snapshots, like the jewelry specification.
 */
export interface LabSpecification {
  deliverable: ModelDeliverable;
  /** Printed height in mm. */
  heightMm: number | null;
  resin: SpecificationChoice | null;
  finish: PrintFinish | null;
  painted: boolean;
  base: { code: string; name: string } | null;
  quantity: number;
  /** The customer's file to start from or fix (a Lab model file). */
  sourceFile: { id: string; name: string } | null;
  comments: string | null;
}
