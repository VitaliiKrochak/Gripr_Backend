import type {
  PrintFileStatus,
  Resin,
} from '../../integrations/database/database.schema';
import type { MeshSize } from './mesh/mesh.measure';
import {
  calculatePrint,
  NO_PRINT_OVERRIDES,
  printScale,
} from './print.pricing';
import type {
  PrintCalculation,
  PrintOverrides,
  PrintPrinter,
} from './print.pricing';
import type { PrintBase, PrintFinish, PrintSettings } from './print.settings';

/** The measurements of the customer's model file. */
export interface CustomPrintFile {
  status: PrintFileStatus;
  volumeMl: number | null;
  sizeMm: MeshSize | null;
}

/** The customer's choices for one model, with the staff adjustments. */
export interface CustomPrintItem {
  quantity: number;
  heightMm: number | null;
  scaleFactor: number | null;
  resinId: string | null;
  finish: PrintFinish;
  painted: boolean;
  base: PrintBase | null;
  /** Staff: e.g. × 3 for complex painting; else the settings multiplier. */
  paintingMultiplier: number | null;
  /** Staff: slicer values at the printed size. */
  overrides: PrintOverrides | null;
}

export interface CustomPrintInputs {
  settings: PrintSettings;
  printer: PrintPrinter | null;
  resins: Map<string, Resin>;
  defaultResin: Resin | null;
}

export type CustomPrintPrice =
  | {
      unitPrice: number;
      lineTotal: number;
      calculation: PrintCalculation;
      error: null;
    }
  | { unitPrice: null; lineTotal: null; calculation: null; error: string };

/**
 * Prices one custom print with the print calculator. The model is scaled to
 * the requested height or factor first, so staff overrides are values at the
 * printed size.
 */
export function priceCustomPrint(
  item: CustomPrintItem,
  file: CustomPrintFile | null,
  inputs: CustomPrintInputs,
): CustomPrintPrice {
  const error = (message: string): CustomPrintPrice => ({
    unitPrice: null,
    lineTotal: null,
    calculation: null,
    error: message,
  });

  if (!file) return error('The model file was deleted');
  if (file.status === 'uploading' || file.status === 'analyzing') {
    return error('The model is still being measured');
  }
  if (file.status === 'failed') return error('The model could not be measured');
  if (file.volumeMl === null || !file.sizeMm) {
    return error('Price after review: staff measure this model');
  }
  if (!inputs.printer) return error('Lab printing is not set up yet');

  const resin = item.resinId
    ? inputs.resins.get(item.resinId)
    : (inputs.defaultResin ?? undefined);

  if (!resin) return error('Choose a resin');
  if (!resin.isActive) return error(`"${resin.name}" is not available`);

  const native = { volumeMl: file.volumeMl, sizeMm: file.sizeMm };
  const s = printScale(native, {
    heightMm: item.heightMm,
    scaleFactor: item.scaleFactor,
  });
  const calculation = calculatePrint(
    {
      model: {
        volumeMl: native.volumeMl * s ** 3,
        sizeMm: {
          x: native.sizeMm.x * s,
          y: native.sizeMm.y * s,
          z: native.sizeMm.z * s,
        },
      },
      scale: 1,
      resin,
      finish: item.finish,
      paintingMultiplier:
        item.paintingMultiplier ??
        (item.painted ? inputs.settings.painting.painted : 1),
      extras: item.base?.price ?? 0,
      overrides: item.overrides ?? NO_PRINT_OVERRIDES,
    },
    inputs.printer,
    inputs.settings,
  );

  return {
    unitPrice: calculation.unitPrice,
    lineTotal: calculation.unitPrice * item.quantity,
    calculation,
    error: null,
  };
}
