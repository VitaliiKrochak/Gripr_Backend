import type { ProductPricing } from '../../integrations/database/database.schema';
import { configureProduct } from '../catalog/product.configuration';
import type { ConfigurableProduct } from '../catalog/product.configuration';
import { marginalPricePerGram } from './pricing.engine';
import type { MetalQuote } from './pricing.engine';
import { planProductPrices } from './product.price.plan';
import type {
  PlanGroup,
  PlanMetal,
  PlanStone,
  ProductPlanInput,
  ProductPricePlan,
} from './product.price.plan';
import {
  DEFAULT_PRICING_SETTINGS,
  defaultMetalProfile,
} from './pricing.settings';

const settings = DEFAULT_PRICING_SETTINGS;

const pricing: ProductPricing = {
  mode: 'auto',
  metalId: null,
  laborType: 'basic',
  laborHours: 4,
  jeweler: 'owner',
  setter: 'owner',
  scenario: null,
  urgency: 0,
  extraProfit: 0,
  delivery: null,
  packaging: null,
  consumables: null,
  services: [],
  fittings: [],
  overrides: {
    alloyPricePerGram: null,
    marginPerGram: null,
    lossRate: null,
    metalBuffer: null,
    externalMarkup: null,
    overhead: null,
    risk: null,
    roundingStep: null,
    minProfit: null,
  },
};

function metal(
  id: string,
  family: MetalQuote['family'],
  fineness: number,
  purePricePerGram: number,
  pricePerGram?: number | null,
): PlanMetal {
  const quote: MetalQuote = {
    family,
    fineness,
    purePricePerGram,
    profile: defaultMetalProfile(family, fineness),
  };
  return {
    id,
    name: id,
    quote,
    pricePerGram:
      pricePerGram === undefined
        ? marginalPricePerGram(quote, settings)
        : pricePerGram,
  };
}

const gold = metal('gold-585', 'gold', 585, 578906.7136);
const silver = metal('silver-925', 'silver', 925, 7000);

function metalGroup(...ids: string[]): PlanGroup {
  return {
    kind: 'metal',
    isRequired: true,
    values: ids.map((metalId, index) => ({
      metalId,
      weightDeltaGrams: 0,
      priceDelta: 0,
      isDefault: index === 0,
      isAvailable: true,
    })),
  };
}

function plan(overrides: Partial<ProductPlanInput>): ProductPricePlan {
  return planProductPrices(
    {
      pricing,
      weightGrams: 5,
      stones: [],
      optionGroups: [metalGroup('gold-585', 'silver-925')],
      metals: new Map([gold, silver].map((m) => [m.id, m])),
      usdRate: settings.usdRate,
      ...overrides,
    },
    settings,
  );
}

/** Storefront quote of the planned product with the given metal value. */
function quote(
  input: Partial<ProductPlanInput>,
  result: ProductPricePlan,
  valueIndex = 0,
): number {
  const groups = input.optionGroups ?? [metalGroup('gold-585', 'silver-925')];
  const metals = new Map([gold, silver].map((m) => [m.id, m]));
  const product: ConfigurableProduct = {
    basePrice: result.basePrice,
    productionDaysMin: 0,
    productionDaysMax: 0,
    weightGrams: input.weightGrams === undefined ? 5 : input.weightGrams,
    stones: (input.stones ?? []).map((stone, index) => ({
      quantity: stone.quantity,
      unitPrice: result.stoneUnitPrices[index],
    })),
    optionGroups: groups.map((group, groupIndex) => ({
      id: `g${groupIndex}`,
      name: group.kind,
      kind: group.kind,
      isRequired: group.isRequired,
      values: group.values.map((value, index) => {
        const variant = result.variants.find((v) => v.valueIndex === index);
        return {
          id: `g${groupIndex}v${index}`,
          label: String(index),
          priceDelta:
            group.kind === 'metal'
              ? (variant?.priceDelta ?? 0)
              : value.priceDelta,
          productionDaysDelta: 0,
          isDefault: value.isDefault,
          isAvailable: value.isAvailable,
          weightDeltaGrams: value.weightDeltaGrams,
          metal: value.metalId ? metals.get(value.metalId) : null,
        };
      }),
    })),
  };
  const metalGroupIndex = groups.findIndex((g) => g.kind === 'metal');
  return configureProduct(
    product,
    metalGroupIndex >= 0 ? [`g${metalGroupIndex}v${valueIndex}`] : [],
  ).unitPrice;
}

describe('planProductPrices', () => {
  it('reproduces the sheet price of the default metal on the storefront', () => {
    const result = plan({});
    const goldVariant = result.variants.find((v) => v.metalId === 'gold-585')!;

    expect(goldVariant.isDefault).toBe(true);
    expect(goldVariant.totalPrice).toBe(3_840_000);
    expect(goldVariant.priceDelta).toBe(0);
    expect(result.basePrice).toBe(3_840_000 - goldVariant.metalPrice);
    expect(quote({}, result, 0)).toBe(3_840_000);
    expect(result.warnings).toEqual([]);
  });

  it('prices every other metal with its own calculation', () => {
    const result = plan({});
    const silverVariant = result.variants.find(
      (v) => v.metalId === 'silver-925',
    )!;

    expect(silverVariant.totalPrice).toBeLessThan(3_840_000);
    expect(quote({}, result, 1)).toBe(silverVariant.totalPrice);
  });

  it('includes the default size weight and keeps other surcharges on top', () => {
    const optionGroups: PlanGroup[] = [
      metalGroup('gold-585', 'silver-925'),
      {
        kind: 'size',
        isRequired: true,
        values: [
          {
            metalId: null,
            weightDeltaGrams: 0.5,
            priceDelta: 30_000,
            isDefault: true,
            isAvailable: true,
          },
        ],
      },
    ];
    const result = plan({ optionGroups });
    const goldVariant = result.variants.find((v) => v.metalId === 'gold-585')!;

    expect(goldVariant.weightGrams).toBe(5.5);
    expect(quote({ optionGroups }, result, 0)).toBe(
      goldVariant.totalPrice + 30_000,
    );
  });

  it('calculates stone prices and keeps hand-priced stones', () => {
    const stones: PlanStone[] = [
      {
        quantity: 2,
        unitPrice: 0,
        purchasePrice: 50_000,
        settingType: 'prong',
        cut: 'oval',
        sizeMm: 2.5,
        settingCost: 0,
      },
      {
        quantity: 1,
        unitPrice: 12_300,
        purchasePrice: null,
        settingType: null,
        cut: null,
        sizeMm: null,
        settingCost: 0,
      },
    ];
    const result = plan({ stones });
    const goldVariant = result.variants.find((v) => v.metalId === 'gold-585')!;

    expect(result.stoneUnitPrices[0]).toBeGreaterThan(50_000);
    expect(result.stoneUnitPrices[1]).toBe(12_300);
    expect(quote({ stones }, result, 0)).toBe(goldVariant.totalPrice + 12_300);
  });

  it('keeps the metal in the manufacturing price without a metal option', () => {
    const result = plan({
      optionGroups: [],
      pricing: { ...pricing, metalId: 'gold-585' },
    });

    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].metalPrice).toBe(0);
    expect(result.basePrice).toBe(3_840_000);
  });

  it('charges the hand-entered metal price when the market price is missing', () => {
    const noRate = metal('gold-585', 'gold', 585, 0, 250_000);
    const input = { metals: new Map([[noRate.id, noRate]]) };
    const optionGroups = [metalGroup('gold-585')];
    const result = plan({ ...input, optionGroups });

    expect(result.warnings).toContain('missing_market_price');
    expect(result.variants[0].metalPrice).toBe(0);
    expect(result.basePrice).toBe(result.variants[0].totalPrice);
  });

  it('warns about a weight without a metal', () => {
    const result = plan({ optionGroups: [] });

    expect(result.warnings).toEqual(['missing_metal']);
  });
});
