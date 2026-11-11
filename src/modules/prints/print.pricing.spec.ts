import { printerCosts } from './printer.costs';
import {
  calculatePrint,
  NO_PRINT_OVERRIDES,
  printScale,
} from './print.pricing';
import type { PrintJob, PrintPrinter } from './print.pricing';
import { DEFAULT_PRINT_SETTINGS } from './print.settings';

const USD_RATE = 42;

const SATURN: PrintPrinter = {
  buildXMm: 211.68,
  buildYMm: 118.37,
  buildZMm: 220,
  layerHeightMm: 0.05,
  secondsPerLayer: 5.5,
  bottomLayers: 5,
  bottomLayerSeconds: 30,
  fixedMinutes: 10,
  electricityPerHour: 100,
  plateFillRate: 0.7,
  spacingMm: 5,
  costs: printerCosts(
    {
      costCurrency: 'USD',
      price: 56300,
      lifetimeHours: 5000,
      lcdPrice: 14100,
      lcdLifetimeHours: 2000,
      filmPrice: 600,
      layersPerFilm: 60000,
    },
    USD_RATE,
  ),
};

/** The example of the Lab plan: 20 ml, 60 mm tall, 25 × 25 mm. */
const EXAMPLE: PrintJob = {
  model: { volumeMl: 20, sizeMm: { x: 25, y: 25, z: 60 } },
  scale: 1,
  resin: { densityGPerMl: 1.1, pricePerKg: 70000 },
  finish: 'supports_removed',
  paintingMultiplier: 1,
  extras: 0,
  overrides: NO_PRINT_OVERRIDES,
};

const price = (job: Partial<PrintJob>) =>
  calculatePrint({ ...EXAMPLE, ...job }, SATURN, DEFAULT_PRINT_SETTINGS);

describe('print pricing', () => {
  it('prices the plan example on a shared plate', () => {
    const result = price({});

    expect(result.piecesPerPlate).toBe(19);
    expect(result.plateShare).toBeCloseTo(1 / 19);
    expect(result.resinMl).toBeCloseTo(25.2);
    expect(result.layers).toBe(1200);
    expect(result.printHours).toBeCloseTo(2.034, 3);
    expect(result.costs.resin).toBeCloseTo(1940.4);
    expect(result.costs.consumables).toBeCloseTo(2000 / 19);
    expect(result.costs.work).toBeCloseTo(1666.67, 1);
    expect(result.costs.fixed).toBe(1000);
    expect(result.cost).toBe(5038);
    expect(result.unitPrice).toBe(9000);
  });

  it('prices the plan example alone on the plate', () => {
    const result = price({
      overrides: { ...NO_PRINT_OVERRIDES, plateShare: 1 },
    });

    expect(result.costs.electricity).toBeCloseTo(203.4, 1);
    expect(result.costs.wear).toBeCloseTo(1564.2, 1);
    expect(result.costs.film).toBeCloseTo(504);
    expect(result.costs.failure).toBeCloseTo(421.2, 1);
    expect(result.cost).toBe(9300);
    expect(result.unitPrice).toBe(16000);
  });

  it('multiplies the unpainted price for painting', () => {
    expect(price({ paintingMultiplier: 2 }).unitPrice).toBe(18000);
    expect(price({ paintingMultiplier: 3 }).unitPrice).toBe(27000);
  });

  it('wears the film per layer, so taller prints pay more', () => {
    const short = price({
      overrides: { ...NO_PRINT_OVERRIDES, plateShare: 1 },
    });
    const tall = price({
      model: { volumeMl: 20, sizeMm: { x: 25, y: 25, z: 120 } },
      overrides: { ...NO_PRINT_OVERRIDES, plateShare: 1 },
    });

    expect(tall.layers).toBe(2400);
    expect(tall.costs.film).toBeCloseTo(short.costs.film * 2);
  });

  it('grows the resin with the cube of the scale', () => {
    const double = price({ scale: 2 });

    expect(double.resinMl).toBeCloseTo(25.2 * 8);
    expect(double.sizeMm).toEqual({ x: 50, y: 50, z: 120 });
    expect(double.piecesPerPlate).toBe(Math.floor(17539.6 / 3025));
  });

  it('scales the slicer overrides with the size', () => {
    const result = price({
      scale: 2,
      overrides: { ...NO_PRINT_OVERRIDES, resinMl: 10, printHours: 1 },
    });

    expect(result.resinMl).toBeCloseTo(80);
    expect(result.printHours).toBeCloseTo(2);
  });

  it('puts a piece that does not fit alone on the plate', () => {
    const result = price({ scale: 4 });

    expect(result.fitsPrinter).toBe(false);
    expect(result.piecesPerPlate).toBe(1);
  });

  it('adds extras such as a base to the cost', () => {
    const plain = price({});
    const withBase = price({ extras: 5000 });

    expect(withBase.cost).toBe(plain.cost + 5000);
  });

  it('derives the scale from a target height or a factor', () => {
    expect(printScale(EXAMPLE.model, { heightMm: 30 })).toBe(0.5);
    expect(printScale(EXAMPLE.model, { scaleFactor: 1.5 })).toBe(1.5);
    expect(printScale(EXAMPLE.model, {})).toBe(1);
  });
});
