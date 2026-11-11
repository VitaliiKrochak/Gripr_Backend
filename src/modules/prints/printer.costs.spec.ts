import { printerCosts, toKopiykas } from './printer.costs';
import type { PrinterPurchase } from './printer.costs';

const SATURN: PrinterPurchase = {
  costCurrency: 'USD',
  price: 56300,
  lifetimeHours: 5000,
  lcdPrice: 14100,
  lcdLifetimeHours: 2000,
  filmPrice: 600,
  layersPerFilm: 60000,
};

describe('printer costs', () => {
  it('converts USD cents to kopiykas and keeps UAH as is', () => {
    expect(toKopiykas(100, 'USD', 42)).toBe(4200);
    expect(toKopiykas(100, 'UAH', 42)).toBe(100);
  });

  it('spreads the printer, LCD and film over their lifetime', () => {
    const costs = printerCosts(SATURN, 42);

    expect(costs.price).toBe(2_364_600);
    expect(costs.lcdPrice).toBe(592_200);
    expect(costs.filmPrice).toBe(25_200);
    expect(costs.wearPerHour).toBeCloseTo(2_364_600 / 5000 + 592_200 / 2000);
    expect(costs.filmPerLayer).toBeCloseTo(25_200 / 60000);
  });

  it('treats a zero lifetime as no wear', () => {
    const costs = printerCosts(
      {
        ...SATURN,
        costCurrency: 'UAH',
        lifetimeHours: 0,
        lcdLifetimeHours: 0,
        layersPerFilm: 0,
      },
      42,
    );

    expect(costs.price).toBe(56300);
    expect(costs.wearPerHour).toBe(0);
    expect(costs.filmPerLayer).toBe(0);
  });
});
