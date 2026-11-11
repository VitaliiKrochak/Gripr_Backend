import { mergeDefaults } from '../../shared/settings/merge.defaults';

/** How far a print is cleaned up; each level has its own handling time. */
export const PRINT_FINISHES = ['raw', 'supports_removed', 'sanded'] as const;
export type PrintFinish = (typeof PRINT_FINISHES)[number];

/**
 * A consumable bought in packs. One plate uses `perPlate` units of the pack
 * (pieces, millilitres, or hours of wear for respirator filters), shared by
 * the pieces printed on it.
 */
export interface PrintConsumable {
  name: string;
  /** Kopiykas per pack. */
  packPrice: number;
  /** Units in one pack. */
  packSize: number;
  /** Units used per plate. */
  perPlate: number;
  /** Display unit, e.g. `шт`, `мл`, `год`. */
  unit: string;
}

/** A base customers can add to a custom print; its price is added to the cost. */
export interface PrintBase {
  code: string;
  name: string;
  /** Kopiykas. */
  price: number;
}

/** Gripr Lab print pricing parameters; money in kopiykas, rates as shares. */
export interface PrintSettings {
  material: {
    /** Extra resin for supports and the raft, share of the model volume. */
    supportRate: number;
    /** Resin left on parts, in the wash, and in the vat. */
    wasteRate: number;
    /** Failed prints that must be reprinted, share of the print costs. */
    failureRate: number;
  };
  consumables: PrintConsumable[];
  work: {
    /** Kopiykas per hour of post-processing; 0 leaves work out of the price. */
    hourlyRate: number;
    postProcessingMinutes: Record<PrintFinish, number>;
  };
  /** Painting multiplies the unpainted price of the piece. */
  painting: {
    painted: number;
    complex: number;
  };
  modeling: {
    /** Kopiykas per hour of 3D modeling. */
    hourlyRate: number;
    freeBigRevisions: number;
    freeSmallRevisions: number;
    /** Kopiykas per revision beyond the free ones. */
    bigRevisionPrice: number;
    smallRevisionPrice: number;
  };
  fixedCosts: {
    /** Kopiykas per month: rent, software, subscriptions. */
    monthly: number;
    /** Sold pieces per month that share the fixed costs. */
    expectedPiecesPerMonth: number;
  };
  price: {
    markupRate: number;
    taxRate: number;
    /** Payment provider fee of the Lab shop. */
    paymentFeeRate: number;
    /** Kopiykas; prices are rounded up to it. */
    roundingStep: number;
    productionDaysMin: number;
    productionDaysMax: number;
  };
  /** Bases offered for custom prints. */
  bases: PrintBase[];
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  material: { supportRate: 0.2, wasteRate: 0.05, failureRate: 0.1 },
  consumables: [
    {
      name: 'Нітрилові рукавички',
      packPrice: 30_000,
      packSize: 100,
      perPlate: 2,
      unit: 'шт',
    },
    {
      name: 'Ізопропіловий спирт',
      packPrice: 15_000,
      packSize: 1_000,
      perPlate: 30,
      unit: 'мл',
    },
    {
      name: 'Паперові рушники',
      packPrice: 6_000,
      packSize: 30,
      perPlate: 1,
      unit: 'шт',
    },
    {
      name: 'Фільтри респіратора',
      packPrice: 60_000,
      packSize: 40,
      perPlate: 0.5,
      unit: 'год',
    },
  ],
  work: {
    hourlyRate: 5_000,
    postProcessingMinutes: { raw: 5, supports_removed: 20, sanded: 45 },
  },
  painting: { painted: 2, complex: 3 },
  modeling: {
    hourlyRate: 50_000,
    freeBigRevisions: 1,
    freeSmallRevisions: 2,
    bigRevisionPrice: 100_000,
    smallRevisionPrice: 25_000,
  },
  fixedCosts: { monthly: 500_000, expectedPiecesPerMonth: 500 },
  price: {
    markupRate: 0.5,
    taxRate: 0.06,
    paymentFeeRate: 0.015,
    roundingStep: 1_000,
    productionDaysMin: 2,
    productionDaysMax: 3,
  },
  bases: [],
};

export function mergePrintSettings(stored: unknown): PrintSettings {
  return mergeDefaults(DEFAULT_PRINT_SETTINGS, stored);
}

/** Kopiykas of consumables used by one plate. */
export function consumablesPerPlate(
  consumables: readonly PrintConsumable[],
): number {
  return consumables.reduce(
    (sum, item) =>
      sum +
      (item.packSize > 0
        ? (item.packPrice / item.packSize) * item.perPlate
        : 0),
    0,
  );
}
