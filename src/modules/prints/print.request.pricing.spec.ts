import type { Resin } from '../../integrations/database/database.schema';
import { printerCosts } from './printer.costs';
import { calculatePrint, NO_PRINT_OVERRIDES } from './print.pricing';
import type { PrintPrinter } from './print.pricing';
import { priceCustomPrint } from './print.request.pricing';
import type {
  CustomPrintFile,
  CustomPrintInputs,
  CustomPrintItem,
} from './print.request.pricing';
import { DEFAULT_PRINT_SETTINGS } from './print.settings';

const PRINTER: PrintPrinter = {
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
    42,
  ),
};

const resin = (id: string, isActive = true) =>
  ({
    id,
    name: `Resin ${id}`,
    densityGPerMl: 1.1,
    pricePerKg: 70000,
    isActive,
  }) as Resin;

const GREY = resin('grey');
const TOUGH = resin('tough');

const INPUTS: CustomPrintInputs = {
  settings: DEFAULT_PRINT_SETTINGS,
  printer: PRINTER,
  resins: new Map([
    ['grey', GREY],
    ['tough', TOUGH],
    ['old', resin('old', false)],
  ]),
  defaultResin: GREY,
};

/** 30 mm tall; at 60 mm it is the 20 ml plan example. */
const FILE: CustomPrintFile = {
  status: 'analyzed',
  volumeMl: 2.5,
  sizeMm: { x: 12.5, y: 12.5, z: 30 },
};

const ITEM: CustomPrintItem = {
  quantity: 2,
  heightMm: 60,
  scaleFactor: null,
  resinId: null,
  finish: 'supports_removed',
  painted: false,
  base: null,
  paintingMultiplier: null,
  overrides: null,
};

const reference = (job: Partial<Parameters<typeof calculatePrint>[0]>) =>
  calculatePrint(
    {
      model: { volumeMl: 20, sizeMm: { x: 25, y: 25, z: 60 } },
      scale: 1,
      resin: GREY,
      finish: 'supports_removed',
      paintingMultiplier: 1,
      extras: 0,
      overrides: NO_PRINT_OVERRIDES,
      ...job,
    },
    PRINTER,
    DEFAULT_PRINT_SETTINGS,
  );

describe('custom print pricing', () => {
  it('scales the model to the requested height with the default resin', () => {
    const result = priceCustomPrint(ITEM, FILE, INPUTS);
    const expected = reference({});

    expect(result.error).toBeNull();
    expect(result.unitPrice).toBe(expected.unitPrice);
    expect(result.lineTotal).toBe(expected.unitPrice * 2);
    expect(result.calculation?.sizeMm).toEqual({ x: 25, y: 25, z: 60 });
  });

  it('applies the scale factor, resin, painting, base and staff overrides', () => {
    const painted = priceCustomPrint(
      {
        ...ITEM,
        heightMm: null,
        scaleFactor: 2,
        resinId: 'tough',
        painted: true,
        base: { code: 'round-25', name: 'Round 25 mm', price: 3000 },
      },
      FILE,
      INPUTS,
    );

    expect(painted.unitPrice).toBe(
      reference({
        resin: TOUGH,
        paintingMultiplier: DEFAULT_PRINT_SETTINGS.painting.painted,
        extras: 3000,
      }).unitPrice,
    );

    const staff = priceCustomPrint(
      {
        ...ITEM,
        painted: true,
        paintingMultiplier: 3,
        overrides: { ...NO_PRINT_OVERRIDES, resinMl: 40, printHours: 5 },
      },
      FILE,
      INPUTS,
    );

    expect(staff.unitPrice).toBe(
      reference({
        paintingMultiplier: 3,
        overrides: { ...NO_PRINT_OVERRIDES, resinMl: 40, printHours: 5 },
      }).unitPrice,
    );
  });

  it('keeps the native size without a height or factor', () => {
    const result = priceCustomPrint({ ...ITEM, heightMm: null }, FILE, INPUTS);

    expect(result.calculation?.sizeMm).toEqual(FILE.sizeMm);
  });

  it('explains why an item has no price', () => {
    const error = (
      item: Partial<CustomPrintItem>,
      file: CustomPrintFile | null,
      inputs: Partial<CustomPrintInputs> = {},
    ) =>
      priceCustomPrint({ ...ITEM, ...item }, file, { ...INPUTS, ...inputs })
        .error;

    expect(error({}, null)).toBe('The model file was deleted');
    expect(error({}, { ...FILE, status: 'analyzing' })).toBe(
      'The model is still being measured',
    );
    expect(error({}, { ...FILE, status: 'failed' })).toBe(
      'The model could not be measured',
    );
    expect(error({}, { status: 'manual', volumeMl: null, sizeMm: null })).toBe(
      'Price after review: staff measure this model',
    );
    expect(error({}, FILE, { printer: null })).toBe(
      'Lab printing is not set up yet',
    );
    expect(error({ resinId: 'old' }, FILE)).toBe(
      '"Resin old" is not available',
    );
    expect(error({}, FILE, { defaultResin: null })).toBe('Choose a resin');
  });
});
