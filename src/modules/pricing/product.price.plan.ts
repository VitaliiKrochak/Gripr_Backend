import type {
  OptionGroupKind,
  ProductPricing,
  ProductPricingService,
} from '../../integrations/database/database.schema';
import {
  calculateItem,
  roundUp,
  settingPrice,
  waxPrintCost,
} from './pricing.engine';
import type {
  ItemInput,
  ItemResult,
  ItemServiceInput,
  ItemStoneInput,
  MetalQuote,
} from './pricing.engine';
import type { PricingSettings } from './pricing.settings';

/**
 * Splits the calculated price of an auto-priced product into the parts the
 * storefront quote adds up: the manufacturing price, the metal price per gram
 * times the weight, stone prices, and a surcharge per metal option. The
 * default configuration then costs exactly the calculated price, and every
 * other metal costs its own calculated price.
 */

export interface PlanStone {
  quantity: number;
  unitPrice: number;
  /** `null` with no setting type keeps the hand-entered unit price. */
  purchasePrice: number | null;
  settingType: ItemStoneInput['settingType'];
  cut: ItemStoneInput['cut'];
  sizeMm: number | null;
  settingCost: number;
}

export interface PlanValue {
  metalId: string | null;
  weightDeltaGrams: number;
  priceDelta: number;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface PlanGroup {
  kind: OptionGroupKind;
  isRequired: boolean;
  values: PlanValue[];
}

export interface PlanMetal {
  id: string;
  name: string;
  /** Customer price per gram used by the storefront quote. */
  pricePerGram: number | null;
  quote: MetalQuote;
}

export interface ProductPlanInput {
  pricing: ProductPricing;
  weightGrams: number | null;
  stones: PlanStone[];
  optionGroups: PlanGroup[];
  metals: Map<string, PlanMetal>;
  usdRate: number;
}

export interface PlanVariant {
  metalId: string | null;
  metalName: string | null;
  /** Index of the value in the metal option group, `null` without one. */
  valueIndex: number | null;
  isDefault: boolean;
  weightGrams: number;
  /** Calculated price without hand-priced stones and option surcharges. */
  totalPrice: number;
  /** Part of the price charged through the metal price per gram. */
  metalPrice: number;
  /** Surcharge stored on the metal option value. */
  priceDelta: number;
  result: ItemResult;
}

export const PLAN_WARNINGS = [
  'missing_metal',
  'missing_market_price',
  'negative_base_price',
] as const;
export type PlanWarning = (typeof PLAN_WARNINGS)[number];

export interface ProductPricePlan {
  basePrice: number;
  /** Unit price per stone, in the order of the input stones. */
  stoneUnitPrices: number[];
  variants: PlanVariant[];
  warnings: PlanWarning[];
}

const positive = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) ? Math.max(0, value) : 0;

const isAutoStone = (stone: PlanStone) =>
  stone.purchasePrice != null || stone.settingType != null;

/** Fills service costs and prices from presets and wax print tiers. */
export function resolveServices(
  services: ProductPricingService[],
  settings: PricingSettings,
  usdRate: number,
): ItemServiceInput[] {
  return services.map((service) => {
    const preset = service.code
      ? settings.services.find((p) => p.code === service.code)
      : undefined;
    const tierCost =
      service.category === 'wax_print'
        ? waxPrintCost(service.quantity, settings, usdRate)
        : null;
    const unitCost =
      service.unitCost ?? (preset?.unitCost || null) ?? tierCost ?? 0;
    const unitPrice =
      service.unitPrice ?? (preset?.unitPrice || null) ?? unitCost;

    return {
      category: service.category,
      quantity: service.quantity,
      unitCost,
      unitPrice,
      external: service.external,
    };
  });
}

/** Calculator input of a catalog product for one metal and weight. */
export function productItemInput(
  pricing: ProductPricing,
  metal: MetalQuote | null,
  weightGrams: number,
  stones: PlanStone[],
  settings: PricingSettings,
  usdRate: number,
): ItemInput {
  return {
    metal,
    clientMetal: false,
    weightGrams,
    laborType: pricing.laborType,
    laborHours: pricing.laborHours,
    jeweler: pricing.jeweler,
    setter: pricing.setter,
    scenario: pricing.scenario ?? settings.defaultScenario,
    urgency: pricing.urgency,
    discount: 0,
    extraProfit: pricing.extraProfit,
    delivery: pricing.delivery ?? settings.defaults.delivery,
    packaging: pricing.packaging ?? settings.defaults.packaging,
    consumables: pricing.consumables ?? settings.defaults.consumables,
    services: resolveServices(pricing.services, settings, usdRate),
    stones: stones.filter(isAutoStone).map((stone) => ({
      quantity: stone.quantity,
      purchasePrice: stone.purchasePrice ?? 0,
      settingType: stone.settingType,
      cut: stone.cut,
      sizeMm: stone.sizeMm,
      clientOwned: false,
      settingCost: stone.settingCost,
    })),
    fittings: pricing.fittings.map((fitting) => ({
      quantity: fitting.quantity,
      unitCost: fitting.unitCost,
      unitPrice: fitting.unitPrice,
      clientOwned: false,
    })),
    overrides: pricing.overrides,
  };
}

/**
 * Customer price of one stone: the stone and its setting with their share of
 * overhead and risk, the rush surcharge, tax, and the payment fee.
 */
export function stoneUnitPrice(
  stone: PlanStone,
  pricing: ProductPricing,
  family: MetalQuote['family'],
  settings: PricingSettings,
): number {
  const scenario =
    settings.scenarios[pricing.scenario ?? settings.defaultScenario];
  const overhead = pricing.overrides.overhead ?? scenario.overhead;
  const risk = pricing.overrides.risk ?? scenario.risk;
  const purchase = positive(stone.purchasePrice);
  const settingCost = positive(stone.settingCost);
  const setting = Math.max(
    settingPrice({ ...stone, clientOwned: false }, family, settings),
    settingCost,
  );
  const net =
    purchase * (1 + settings.stoneMarkup) +
    setting +
    (overhead + risk) * (purchase + settingCost);
  const share = 1 - settings.taxRate - settings.paymentFeeRate;

  return share <= 0
    ? 0
    : roundUp((net * (1 + positive(pricing.urgency))) / share, 100);
}

function defaultValue(values: PlanValue[]): PlanValue | undefined {
  const available = values.filter((value) => value.isAvailable);
  return available.find((value) => value.isDefault) ?? available[0];
}

export function planProductPrices(
  input: ProductPlanInput,
  settings: PricingSettings,
): ProductPricePlan {
  const warnings = new Set<PlanWarning>();
  const metalGroup = input.optionGroups.find((group) => group.kind === 'metal');
  const metalValues = (metalGroup?.values ?? [])
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value.metalId && input.metals.has(value.metalId));
  const defaultMetalValue = metalGroup
    ? defaultValue(metalGroup.values)
    : undefined;

  // Weight of the default size and other default options, as on product cards.
  const otherWeight = input.optionGroups
    .filter((group) => group !== metalGroup && group.isRequired)
    .reduce(
      (sum, group) => sum + (defaultValue(group.values)?.weightDeltaGrams ?? 0),
      input.weightGrams ?? 0,
    );

  const candidates: Array<{
    metal: PlanMetal | null;
    valueIndex: number | null;
    weightDelta: number;
    isDefault: boolean;
  }> = metalValues.length
    ? metalValues.map(({ value, index }) => ({
        metal: input.metals.get(value.metalId!)!,
        valueIndex: index,
        weightDelta: value.weightDeltaGrams,
        isDefault: value === defaultMetalValue,
      }))
    : [
        {
          metal: input.pricing.metalId
            ? (input.metals.get(input.pricing.metalId) ?? null)
            : null,
          valueIndex: null,
          weightDelta: 0,
          isDefault: true,
        },
      ];

  if (!candidates.some((c) => c.isDefault)) {
    candidates[0].isDefault = true;
  }

  const defaultCandidate = candidates.find((c) => c.isDefault)!;
  const family = defaultCandidate.metal?.quote.family ?? 'other';
  const stoneUnitPrices = input.stones.map((stone) =>
    isAutoStone(stone)
      ? stoneUnitPrice(stone, input.pricing, family, settings)
      : stone.unitPrice,
  );
  const autoStones = input.stones.reduce(
    (sum, stone, index) =>
      isAutoStone(stone) ? sum + stone.quantity * stoneUnitPrices[index] : sum,
    0,
  );

  const computed = candidates.map((candidate) => {
    const quote = candidate.metal?.quote ?? null;
    const weightGrams =
      input.weightGrams == null
        ? 0
        : Math.max(0, otherWeight + candidate.weightDelta);
    const hasMarketPrice =
      quote != null &&
      (quote.purePricePerGram > 0 ||
        input.pricing.overrides.alloyPricePerGram != null);

    if (!candidate.metal && input.weightGrams) {
      warnings.add('missing_metal');
    } else if (
      candidate.metal &&
      !hasMarketPrice &&
      quote?.family !== 'other'
    ) {
      warnings.add('missing_market_price');
    }

    const result = calculateItem(
      productItemInput(
        input.pricing,
        quote,
        weightGrams,
        input.stones,
        settings,
        input.usdRate,
      ),
      settings,
    );
    // Without a market price the metal stays charged by its hand-entered
    // price per gram on top of the calculated work.
    const metalPrice =
      hasMarketPrice && candidate.valueIndex !== null
        ? Math.round((candidate.metal?.pricePerGram ?? 0) * weightGrams)
        : 0;

    return { candidate, weightGrams, result, metalPrice };
  });

  const defaults = computed.find((c) => c.candidate.isDefault)!;
  const rawBase = defaults.result.finalPrice - defaults.metalPrice - autoStones;

  if (rawBase < 0) {
    warnings.add('negative_base_price');
  }

  const basePrice = Math.max(0, rawBase);
  const variants = computed.map(
    ({ candidate, weightGrams, result, metalPrice }) => ({
      metalId: candidate.metal?.id ?? null,
      metalName: candidate.metal?.name ?? null,
      valueIndex: candidate.valueIndex,
      isDefault: candidate.isDefault,
      weightGrams,
      totalPrice: result.finalPrice,
      metalPrice,
      priceDelta: result.finalPrice - metalPrice - autoStones - basePrice,
      result,
    }),
  );

  return { basePrice, stoneUnitPrices, variants, warnings: [...warnings] };
}
