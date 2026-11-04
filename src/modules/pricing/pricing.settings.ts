import type { MetalFamily } from '../../integrations/database/database.schema';

/** Market codes of the National Bank of Ukraine for precious metals. */
export const SPOT_CODES = ['XAU', 'XAG', 'XPT', 'XPD'] as const;
export type SpotCode = (typeof SPOT_CODES)[number];

export const RATE_CODES = [...SPOT_CODES, 'USD'] as const;
export type RateCode = (typeof RATE_CODES)[number];

export const PRICING_SCENARIOS = ['minimal', 'recommended', 'safe'] as const;
export type PricingScenario = (typeof PRICING_SCENARIOS)[number];

export const LABOR_TYPES = ['none', 'basic', 'complex'] as const;
export type LaborType = (typeof LABOR_TYPES)[number];

export const WORKERS = ['owner', 'hired'] as const;
export type Worker = (typeof WORKERS)[number];

export const SETTING_TYPES = [
  'prong',
  'bezel',
  'pave',
  'channel',
  'flush',
  'glue',
  'pearl_pin',
  'hanging',
] as const;
export type SettingType = (typeof SETTING_TYPES)[number];

export const STONE_CUTS = [
  'round',
  'oval',
  'cushion',
  'princess',
  'emerald',
  'baguette',
  'pear',
  'marquise',
  'trillion',
  'cabochon',
  'fancy',
] as const;
export type StoneCut = (typeof STONE_CUTS)[number];

export const SERVICE_CATEGORIES = [
  'wax_print',
  'rubber',
  'coating',
  'engraving',
  'other',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_UNITS = ['piece', 'gram', 'cm3', 'fixed'] as const;
export type ServiceUnit = (typeof SERVICE_UNITS)[number];

/** Rates that change with the chosen calculation scenario (fractions). */
export interface ScenarioRates {
  /** Buffer against metal price changes, share of the metal cost. */
  metalBuffer: number;
  /** Markup on outside services such as casting and coating. */
  externalMarkup: number;
  /** Small tools, power, and equipment wear, share of direct costs. */
  overhead: number;
  /** Reserve for recasting and defects, share of material costs. */
  risk: number;
}

/** Hourly pay in kopiykas and the business share on top of it. */
export interface WorkerRates {
  ratePerHour: number;
  businessPerHour: number;
  markup: number;
}

export interface ServicePreset {
  code: string;
  category: ServiceCategory;
  name: string;
  unit: ServiceUnit;
  /** Kopiykas per unit paid to the workshop or contractor. */
  unitCost: number;
  /** Kopiykas per unit charged to the customer. */
  unitPrice: number;
}

export type FamilyRates = Record<MetalFamily, number>;

export interface PricingSettings {
  /** Fallback UAH per USD when no market rate is stored. */
  usdRate: number;
  taxRate: number;
  paymentFeeRate: number;
  /** Casting and polishing losses, share of the purchased weight. */
  lossRate: number;
  /** Final prices are rounded up to this step, in kopiykas. */
  roundingStep: number;
  /** The business profit of an item is topped up to this amount. */
  minProfit: number;
  defaultScenario: PricingScenario;
  scenarios: Record<PricingScenario, ScenarioRates>;
  stoneMarkup: number;
  fittingsMarkup: number;
  /** Markup of the casting tariff when the casting is passed to the customer. */
  castingMarkup: number;
  /** Extra charge on setting customer-supplied stones. */
  clientStoneRisk: number;
  itemPrepayment: number;
  jeweler: { ownerMarkup: number; hired: WorkerRates };
  modeling: {
    owner: WorkerRates;
    hired: WorkerRates;
    minPrice: number;
    prepayment: number;
    revisionPrice: number;
  };
  defaults: { delivery: number; packaging: number; consumables: number };
  /** Kopiykas per stone for each setting type and metal family. */
  settingRates: Record<SettingType, FamilyRates>;
  cutFactors: Record<StoneCut, number>;
  /** Ordered by size; `upToMm: null` covers every larger stone. */
  sizeFactors: Array<{ upToMm: number | null; factor: number }>;
  /** USD per cm³ of printed wax by total volume; larger volumes need a manual price. */
  waxPrintTiers: Array<{ upToCm3: number; usdPerCm3: number }>;
  services: ServicePreset[];
}

/** Per-metal pricing; `null` columns fall back to `defaultMetalProfile`. */
export interface MetalPricingProfile {
  /** Margin per gram of the finished piece, kopiykas. */
  marginPerGram: number;
  /** Supplier markup on the alloy, fraction. */
  purchaseMarkup: number;
  /** Price of the non-precious part of the alloy, kopiykas per gram. */
  ligaturePerGram: number;
  /** Casting tariff = pure metal price × share + fixed part, per gram. */
  castingSpotShare: number;
  castingFixedPerGram: number;
  /** Owner jeweler pay per hour, kopiykas. */
  laborRateBasic: number;
  laborRateComplex: number;
  /** Minimum customer price of the jewelry work, kopiykas. */
  minLaborBasic: number;
  minLaborComplex: number;
  /** Keep the metal's price per gram in sync with market rates. */
  autoPricePerGram: boolean;
}

const UAH = 100;

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  usdRate: 44.77,
  taxRate: 0.06,
  paymentFeeRate: 0.03,
  lossRate: 0.1,
  roundingStep: 100 * UAH,
  minProfit: 1000 * UAH,
  defaultScenario: 'recommended',
  scenarios: {
    minimal: { metalBuffer: 0, externalMarkup: 0, overhead: 0.01, risk: 0.02 },
    recommended: {
      metalBuffer: 0.02,
      externalMarkup: 0.05,
      overhead: 0.02,
      risk: 0.03,
    },
    safe: {
      metalBuffer: 0.05,
      externalMarkup: 0.1,
      overhead: 0.03,
      risk: 0.05,
    },
  },
  stoneMarkup: 0.25,
  fittingsMarkup: 0.25,
  castingMarkup: 0.25,
  clientStoneRisk: 0,
  itemPrepayment: 0.5,
  jeweler: {
    ownerMarkup: 0.7,
    hired: { ratePerHour: 250 * UAH, businessPerHour: 260 * UAH, markup: 0.7 },
  },
  modeling: {
    owner: { ratePerHour: 500 * UAH, businessPerHour: 0, markup: 0.7 },
    hired: { ratePerHour: 250 * UAH, businessPerHour: 260 * UAH, markup: 0.7 },
    minPrice: 1000 * UAH,
    prepayment: 0.5,
    revisionPrice: 100 * UAH,
  },
  defaults: {
    delivery: 200 * UAH,
    packaging: 20 * UAH,
    consumables: 200 * UAH,
  },
  settingRates: {
    prong: rates(300, 200, 500, 400, 200),
    bezel: rates(500, 350, 800, 650, 300),
    pave: rates(400, 280, 650, 550, 250),
    channel: rates(450, 320, 750, 600, 300),
    flush: rates(400, 280, 650, 550, 250),
    glue: rates(100, 80, 120, 100, 80),
    pearl_pin: rates(300, 200, 450, 350, 180),
    hanging: rates(350, 240, 550, 450, 220),
  },
  cutFactors: {
    round: 1,
    oval: 1.1,
    cushion: 1.1,
    princess: 1.15,
    emerald: 1.2,
    baguette: 1.25,
    pear: 1.25,
    marquise: 1.3,
    trillion: 1.3,
    cabochon: 1.1,
    fancy: 1.5,
  },
  sizeFactors: [
    { upToMm: 2, factor: 1 },
    { upToMm: 4, factor: 1.15 },
    { upToMm: 6, factor: 1.35 },
    { upToMm: 8, factor: 1.6 },
    { upToMm: null, factor: 2 },
  ],
  waxPrintTiers: [
    { upToCm3: 1, usdPerCm3: 30 },
    { upToCm3: 3, usdPerCm3: 28 },
    { upToCm3: 5, usdPerCm3: 26 },
    { upToCm3: 8, usdPerCm3: 24 },
    { upToCm3: 10, usdPerCm3: 21 },
  ],
  services: [
    service('wax-print', 'wax_print', '3D-друк воскової моделі', 'cm3', 0, 0),
    service('rubber', 'rubber', 'Звичайна резина', 'piece', 250, 315),
    service(
      'rubber-no-shrink',
      'rubber',
      'Безусадкова резина',
      'piece',
      350,
      440,
    ),
    service('rhodium', 'coating', 'Родій', 'gram', 50, 65),
    service('black-rhodium', 'coating', 'Чорний родій', 'fixed', 0, 0),
    service('ruthenium', 'coating', 'Рутеній', 'fixed', 0, 0),
    service('oxidation', 'coating', 'Оксидація / чорніння', 'fixed', 0, 0),
    service('hot-enamel', 'coating', 'Гаряча емаль', 'fixed', 0, 0),
    service(
      'photopolymer-paint',
      'coating',
      'Фотополімерна фарба',
      'fixed',
      0,
      0,
    ),
    service(
      'engraving-mechanical',
      'engraving',
      'Механічне гравірування',
      'fixed',
      0,
      0,
    ),
    service(
      'engraving-laser',
      'engraving',
      'Лазерне гравірування',
      'fixed',
      0,
      0,
    ),
    service('other', 'other', 'Інша послуга', 'fixed', 0, 0),
  ],
};

function rates(
  gold: number,
  silver: number,
  platinum: number,
  palladium: number,
  other: number,
): FamilyRates {
  return {
    gold: gold * UAH,
    silver: silver * UAH,
    platinum: platinum * UAH,
    palladium: palladium * UAH,
    other: other * UAH,
  };
}

function service(
  code: string,
  category: ServiceCategory,
  name: string,
  unit: ServiceUnit,
  unitCost: number,
  unitPrice: number,
): ServicePreset {
  return {
    code,
    category,
    name,
    unit,
    unitCost: unitCost * UAH,
    unitPrice: unitPrice * UAH,
  };
}

export const SPOT_CODE_BY_FAMILY: Partial<Record<MetalFamily, SpotCode>> = {
  gold: 'XAU',
  silver: 'XAG',
  platinum: 'XPT',
  palladium: 'XPD',
};

/** Fineness in parts per thousand from a purity label such as "585" or "Au 750". */
export function parseFineness(
  purity: string | null | undefined,
): number | null {
  const match = purity?.match(/\d{3}/);
  const value = match ? Number(match[0]) : NaN;
  return value > 0 && value <= 1000 ? value : null;
}

/** Workshop tariffs from the pricing sheet, by metal family and fineness. */
export function defaultMetalProfile(
  family: MetalFamily,
  fineness: number | null,
  code = '',
): MetalPricingProfile {
  const base = {
    purchaseMarkup: 0.05,
    ligaturePerGram: 0,
    castingSpotShare: 0.02,
    autoPricePerGram: false,
  };

  switch (family) {
    case 'gold': {
      const yellowOrRose750 =
        (fineness ?? 0) >= 750 && !/white|біл/i.test(code);
      return {
        ...base,
        marginPerGram: 1500 * UAH,
        castingFixedPerGram: (yellowOrRose750 ? 100 : 80) * UAH,
        laborRateBasic: 700 * UAH,
        laborRateComplex: 1000 * UAH,
        minLaborBasic: 1200 * UAH,
        minLaborComplex:
          (fineness ?? 0) >= 958
            ? 1800 * UAH
            : (fineness ?? 0) >= 750
              ? 1700 * UAH
              : 1500 * UAH,
      };
    }
    case 'silver':
      return {
        ...base,
        marginPerGram: 350 * UAH,
        castingFixedPerGram: 30 * UAH,
        laborRateBasic: 250 * UAH,
        laborRateComplex: 450 * UAH,
        minLaborBasic: 500 * UAH,
        minLaborComplex: 900 * UAH,
      };
    case 'platinum':
      return {
        ...base,
        marginPerGram: 1600 * UAH,
        castingFixedPerGram: 80 * UAH,
        laborRateBasic: 1000 * UAH,
        laborRateComplex: 1000 * UAH,
        minLaborBasic: 2000 * UAH,
        minLaborComplex: 3000 * UAH,
      };
    case 'palladium':
      return {
        ...base,
        marginPerGram: 1800 * UAH,
        castingFixedPerGram: 80 * UAH,
        laborRateBasic: 900 * UAH,
        laborRateComplex: 1400 * UAH,
        minLaborBasic: 1500 * UAH,
        minLaborComplex: 2200 * UAH,
      };
    default:
      return {
        ...base,
        marginPerGram: 0,
        castingSpotShare: 0,
        castingFixedPerGram: 0,
        laborRateBasic: 250 * UAH,
        laborRateComplex: 450 * UAH,
        minLaborBasic: 500 * UAH,
        minLaborComplex: 900 * UAH,
      };
  }
}
