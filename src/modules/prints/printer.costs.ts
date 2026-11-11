export const COST_CURRENCIES = ['UAH', 'USD'] as const;
export type CostCurrency = (typeof COST_CURRENCIES)[number];

/** Purchase prices of a printer in minor units (cents or kopiykas). */
export interface PrinterPurchase {
  costCurrency: CostCurrency;
  price: number;
  lifetimeHours: number;
  lcdPrice: number;
  lcdLifetimeHours: number;
  filmPrice: number;
  layersPerFilm: number;
}

export interface PrinterCosts {
  /** Kopiykas, converted at `usdRate` for USD prices. */
  price: number;
  lcdPrice: number;
  filmPrice: number;
  /** Kopiykas of printer and LCD depreciation per printing hour. */
  wearPerHour: number;
  /** Kopiykas of release film wear per printed layer. */
  filmPerLayer: number;
}

/** Converts minor units of the currency to kopiykas; USD uses UAH per dollar. */
export function toKopiykas(
  amount: number,
  currency: CostCurrency,
  usdRate: number,
): number {
  return currency === 'USD' ? amount * usdRate : amount;
}

export function printerCosts(
  printer: PrinterPurchase,
  usdRate: number,
): PrinterCosts {
  const price = toKopiykas(printer.price, printer.costCurrency, usdRate);
  const lcdPrice = toKopiykas(printer.lcdPrice, printer.costCurrency, usdRate);
  const filmPrice = toKopiykas(
    printer.filmPrice,
    printer.costCurrency,
    usdRate,
  );
  const perHour = (amount: number, hours: number) =>
    hours > 0 ? amount / hours : 0;

  return {
    price: Math.round(price),
    lcdPrice: Math.round(lcdPrice),
    filmPrice: Math.round(filmPrice),
    wearPerHour:
      perHour(price, printer.lifetimeHours) +
      perHour(lcdPrice, printer.lcdLifetimeHours),
    filmPerLayer:
      printer.layersPerFilm > 0 ? filmPrice / printer.layersPerFilm : 0,
  };
}
