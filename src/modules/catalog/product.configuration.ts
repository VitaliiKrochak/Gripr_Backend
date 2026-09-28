import type {
  OptionGroupKind,
  SelectedOption,
} from '../../integrations/database/database.schema';

export const MAX_ENGRAVING_LENGTH = 40;

export interface ConfigurableValue {
  id: string;
  label: string;
  priceDelta: number;
  productionDaysDelta: number;
  isDefault: boolean;
  isAvailable: boolean;
  /** Extra metal in grams, e.g. for a larger size. */
  weightDeltaGrams?: number;
  metal?: { pricePerGram: number | null } | null;
}

export interface ConfigurableGroup {
  id: string;
  name: string;
  kind: OptionGroupKind;
  isRequired: boolean;
  values: ConfigurableValue[];
}

export interface ConfigurableStone {
  quantity: number;
  unitPrice: number;
}

export interface ConfigurableProduct {
  /** Manufacturing price in kopiykas. */
  basePrice: number;
  productionDaysMin: number;
  productionDaysMax: number;
  /** Metal weight of the default size; enables metal pricing per gram. */
  weightGrams?: number | null;
  stones?: ConfigurableStone[];
  optionGroups: ConfigurableGroup[];
}

/** Parts of the unit price, all in kopiykas. */
export interface PriceBreakdown {
  manufacturing: number;
  metal: number;
  stones: number;
  options: number;
  /** Metal weight of the configuration, `null` when the product has none. */
  weightGrams: number | null;
}

export interface Configuration {
  unitPrice: number;
  breakdown: PriceBreakdown;
  productionDaysMin: number;
  productionDaysMax: number;
  /** Explicit selection including defaults applied for required groups. */
  optionValueIds: string[];
  selectedOptions: SelectedOption[];
  engravingText: string | null;
}

export class ConfigurationError extends Error {}

/**
 * Validates a configurator selection and computes its price and production
 * time. Required groups without a selection fall back to their default value.
 */
export function configureProduct(
  product: ConfigurableProduct,
  optionValueIds: string[],
  engravingText?: string | null,
): Configuration {
  const groupByValue = new Map<string, ConfigurableGroup>();

  for (const group of product.optionGroups) {
    for (const value of group.values) {
      groupByValue.set(value.id, group);
    }
  }

  const chosen = new Map<string, ConfigurableValue>();

  for (const valueId of new Set(optionValueIds)) {
    const group = groupByValue.get(valueId);

    if (!group) {
      throw new ConfigurationError(
        `Option ${valueId} does not belong to this product`,
      );
    }

    if (chosen.has(group.id)) {
      throw new ConfigurationError(
        `Only one option can be selected for "${group.name}"`,
      );
    }

    const value = group.values.find((candidate) => candidate.id === valueId)!;

    if (!value.isAvailable) {
      throw new ConfigurationError(`"${value.label}" is not available`);
    }

    chosen.set(group.id, value);
  }

  const selectedOptions: SelectedOption[] = [];
  let hasEngraving = false;

  for (const group of product.optionGroups) {
    let value = chosen.get(group.id);

    if (!value && group.isRequired) {
      value = group.values.find(
        (candidate) => candidate.isDefault && candidate.isAvailable,
      );

      if (!value) {
        throw new ConfigurationError(`Select an option for "${group.name}"`);
      }
    }

    if (!value) {
      continue;
    }

    hasEngraving ||= group.kind === 'engraving';
    selectedOptions.push({
      groupId: group.id,
      groupName: group.name,
      kind: group.kind,
      valueId: value.id,
      label: value.label,
      priceDelta: value.priceDelta,
    });
  }

  const engraving = engravingText?.trim() || null;

  if (hasEngraving && !engraving) {
    throw new ConfigurationError('Engraving text is required');
  }

  if (!hasEngraving && engraving) {
    throw new ConfigurationError(
      'Engraving text requires selecting an engraving option',
    );
  }

  if (engraving && engraving.length > MAX_ENGRAVING_LENGTH) {
    throw new ConfigurationError(
      `Engraving text must not exceed ${MAX_ENGRAVING_LENGTH} characters`,
    );
  }

  const values = product.optionGroups
    .flatMap((group) => group.values)
    .filter((value) =>
      selectedOptions.some((selected) => selected.valueId === value.id),
    );
  const daysDelta = values.reduce(
    (sum, value) => sum + value.productionDaysDelta,
    0,
  );
  const breakdown = priceBreakdown(product, values);
  const unitPrice =
    breakdown.manufacturing +
    breakdown.metal +
    breakdown.stones +
    breakdown.options;

  if (unitPrice < 0) {
    throw new ConfigurationError('Configured price cannot be negative');
  }

  return {
    unitPrice,
    breakdown,
    productionDaysMin: Math.max(0, product.productionDaysMin + daysDelta),
    productionDaysMax: Math.max(0, product.productionDaysMax + daysDelta),
    optionValueIds: selectedOptions.map((selected) => selected.valueId),
    selectedOptions,
    engravingText: engraving,
  };
}

function priceBreakdown(
  product: ConfigurableProduct,
  selected: ConfigurableValue[],
): PriceBreakdown {
  const weightGrams =
    product.weightGrams == null
      ? null
      : Math.max(
          0,
          selected.reduce(
            (sum, value) => sum + (value.weightDeltaGrams ?? 0),
            product.weightGrams,
          ),
        );
  const pricePerGram =
    selected.find((value) => value.metal?.pricePerGram != null)?.metal
      ?.pricePerGram ?? 0;

  return {
    manufacturing: product.basePrice,
    metal: weightGrams === null ? 0 : Math.round(pricePerGram * weightGrams),
    stones: (product.stones ?? []).reduce(
      (sum, stone) => sum + stone.quantity * stone.unitPrice,
      0,
    ),
    options: selected.reduce((sum, value) => sum + value.priceDelta, 0),
    weightGrams,
  };
}

/**
 * Price shown on product cards: the default configuration, or the fixed
 * parts of the price when the product has no complete default.
 */
export function priceFrom(product: ConfigurableProduct): number {
  try {
    return configureProduct(product, []).unitPrice;
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw error;
    }

    const breakdown = priceBreakdown(product, []);
    return Math.max(0, breakdown.manufacturing + breakdown.stones);
  }
}

export interface PricedLine {
  key: string;
  productId: string;
  unitPrice: number;
  quantity: number;
}

export interface ProductSet {
  collectionId: string;
  productIds: string[];
  discountPercent: number;
}

/**
 * Applies set discounts: every complete set in the cart (one unit of each
 * product in the set) gets `discountPercent` off those units.
 * Returns the discount in kopiykas per line key.
 */
export function applySetDiscounts(
  lines: PricedLine[],
  sets: ProductSet[],
): Map<string, number> {
  const discounts = new Map<string, number>();

  for (const set of sets) {
    if (set.discountPercent <= 0 || set.productIds.length < 2) {
      continue;
    }

    const completeSets = Math.min(
      ...set.productIds.map((productId) =>
        lines
          .filter((line) => line.productId === productId)
          .reduce((sum, line) => sum + line.quantity, 0),
      ),
    );

    if (completeSets < 1) {
      continue;
    }

    for (const productId of set.productIds) {
      let remaining = completeSets;

      for (const line of lines.filter((l) => l.productId === productId)) {
        const units = Math.min(remaining, line.quantity);
        remaining -= units;
        discounts.set(
          line.key,
          (discounts.get(line.key) ?? 0) +
            Math.round((line.unitPrice * units * set.discountPercent) / 100),
        );

        if (!remaining) {
          break;
        }
      }
    }
  }

  return discounts;
}

/** Combines production estimates of several items made in parallel. */
export function combineProductionDays(
  items: Array<{ productionDaysMin: number; productionDaysMax: number }>,
): { productionDaysMin: number; productionDaysMax: number } {
  return {
    productionDaysMin: Math.max(0, ...items.map((i) => i.productionDaysMin)),
    productionDaysMax: Math.max(0, ...items.map((i) => i.productionDaysMax)),
  };
}
