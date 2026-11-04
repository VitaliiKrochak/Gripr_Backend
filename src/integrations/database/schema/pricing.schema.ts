import { doublePrecision, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import type {
  LaborType,
  PricingScenario,
  PricingSettings,
  ServiceCategory,
  Worker,
} from '../../../modules/pricing/pricing.settings';
import { appSchema, timestamps } from './common.schema';

export const PRICING_MODES = ['auto', 'manual'] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

/** Workshop-wide pricing parameters; a single row with id `default`. */
export const pricingSettings = appSchema.table('pricing_settings', {
  id: text('id').primaryKey(),
  settings: jsonb('settings').$type<PricingSettings>().notNull(),
  ...timestamps,
});

/**
 * Market rates in UAH: per troy ounce for metals (`XAU`, `XAG`, `XPT`, `XPD`)
 * and per dollar for `USD`. A manual rate replaces the market rate.
 */
export const marketRates = appSchema.table('market_rates', {
  code: text('code').primaryKey(),
  marketRate: doublePrecision('market_rate'),
  manualRate: doublePrecision('manual_rate'),
  /** Date the market rate is valid for, as published by the source. */
  rateDate: text('rate_date'),
  source: text('source'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }),
  ...timestamps,
});

export interface ProductPricingService {
  /** Preset code from the pricing settings, `null` for a custom service. */
  code: string | null;
  category: ServiceCategory;
  name: string;
  /** Pieces, grams, cm³ (wax print), or 1 for a fixed price. */
  quantity: number;
  /** Kopiykas per unit; `null` uses the preset or the wax print tier. */
  unitCost: number | null;
  unitPrice: number | null;
  external: boolean;
}

export interface ProductPricingFitting {
  name: string;
  quantity: number;
  unitCost: number;
  /** `null` applies the fittings markup to the cost. */
  unitPrice: number | null;
}

/** Calculator inputs of a catalog product; `manual` keeps hand-entered prices. */
export interface ProductPricing {
  mode: PricingMode;
  /** Metal priced when the product has no metal option group. */
  metalId: string | null;
  laborType: LaborType;
  laborHours: number;
  jeweler: Worker;
  setter: Worker;
  /** `null` uses the default scenario of the settings. */
  scenario: PricingScenario | null;
  urgency: number;
  extraProfit: number;
  /** Kopiykas; `null` uses the settings defaults. */
  delivery: number | null;
  packaging: number | null;
  consumables: number | null;
  services: ProductPricingService[];
  fittings: ProductPricingFitting[];
  overrides: {
    alloyPricePerGram: number | null;
    marginPerGram: number | null;
    lossRate: number | null;
    metalBuffer: number | null;
    externalMarkup: number | null;
    overhead: number | null;
    risk: number | null;
    roundingStep: number | null;
    minProfit: number | null;
  };
}

export type PricingSettingsRow = typeof pricingSettings.$inferSelect;
export type MarketRate = typeof marketRates.$inferSelect;
