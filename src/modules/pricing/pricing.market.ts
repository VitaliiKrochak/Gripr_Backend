import type { MetalFamily } from '../../integrations/database/database.schema';
import { TROY_OUNCE_GRAMS } from './pricing.engine';
import type { MetalQuote } from './pricing.engine';
import {
  DEFAULT_PRICING_SETTINGS,
  defaultMetalProfile,
  parseFineness,
  SPOT_CODE_BY_FAMILY,
} from './pricing.settings';
import type { MetalPricingProfile, PricingSettings } from './pricing.settings';

export interface QuotableMetal {
  code: string;
  family: MetalFamily;
  purity: string | null;
  pricingProfile: MetalPricingProfile | null;
}

/** Kopiykas per gram of the pure metal from UAH-per-ounce rates; 0 without a rate. */
export function purePricePerGram(
  family: MetalFamily,
  rates: ReadonlyMap<string, number>,
): number {
  const code = SPOT_CODE_BY_FAMILY[family];
  const perOunce = code ? rates.get(code) : undefined;
  return perOunce ? (perOunce / TROY_OUNCE_GRAMS) * 100 : 0;
}

export function metalProfile(metal: QuotableMetal): MetalPricingProfile {
  const defaults = defaultMetalProfile(
    metal.family,
    parseFineness(metal.purity),
    metal.code,
  );
  return metal.pricingProfile
    ? { ...defaults, ...metal.pricingProfile }
    : defaults;
}

export function metalQuote(
  metal: QuotableMetal,
  rates: ReadonlyMap<string, number>,
): MetalQuote {
  return {
    family: metal.family,
    fineness: parseFineness(metal.purity) ?? 1000,
    purePricePerGram: purePricePerGram(metal.family, rates),
    profile: metalProfile(metal),
  };
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function merge<T>(defaults: T, stored: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(stored)) {
    return (stored === undefined || stored === null ? defaults : stored) as T;
  }

  const result: Record<string, unknown> = { ...defaults };

  for (const [key, value] of Object.entries(defaults)) {
    result[key] = merge(value, stored[key]);
  }

  return result as T;
}

/** Stored settings over the defaults, so newly added parameters get a value. */
export function mergeSettings(stored: unknown): PricingSettings {
  return merge(DEFAULT_PRICING_SETTINGS, stored);
}
