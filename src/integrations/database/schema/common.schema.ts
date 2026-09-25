import { pgSchema, timestamp } from 'drizzle-orm/pg-core';

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
