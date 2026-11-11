import { roundUp } from '../pricing/pricing.engine';
import type { PrinterCosts } from './printer.costs';
import { consumablesPerPlate } from './print.settings';
import type { PrintFinish, PrintSettings } from './print.settings';

/** A model at its reference size: 1 ml = 1 cm³, sizes in millimetres. */
export interface PrintModel {
  volumeMl: number;
  sizeMm: { x: number; y: number; z: number };
}

/** Staff values from the slicer, at the reference size; `null` calculates. */
export interface PrintOverrides {
  supportRate: number | null;
  /** Resin with supports; scaled by `s³` for other sizes. */
  resinMl: number | null;
  /** Hours of one print; scaled by `s` for other sizes. */
  printHours: number | null;
  /** Share of the plate, 1 = alone on the plate. */
  plateShare: number | null;
}

export const NO_PRINT_OVERRIDES: PrintOverrides = {
  supportRate: null,
  resinMl: null,
  printHours: null,
  plateShare: null,
};

export interface PrintResin {
  densityGPerMl: number;
  /** Kopiykas per kilogram. */
  pricePerKg: number;
}

export interface PrintPrinter {
  buildXMm: number;
  buildYMm: number;
  buildZMm: number;
  layerHeightMm: number;
  secondsPerLayer: number;
  bottomLayers: number;
  bottomLayerSeconds: number;
  fixedMinutes: number;
  /** Kopiykas per printing hour. */
  electricityPerHour: number;
  plateFillRate: number;
  spacingMm: number;
  costs: Pick<PrinterCosts, 'wearPerHour' | 'filmPerLayer'>;
}

export interface PrintJob {
  model: PrintModel;
  /** Size factor of the reference model; volume grows with its cube. */
  scale: number;
  resin: PrintResin;
  finish: PrintFinish;
  paintingMultiplier: number;
  /** Kopiykas added to the cost, e.g. a base. */
  extras: number;
  overrides: PrintOverrides;
}

/** Cost lines in kopiykas (unrounded) and the price of one piece. */
export interface PrintCalculation {
  scale: number;
  sizeMm: { x: number; y: number; z: number };
  fitsPrinter: boolean;
  piecesPerPlate: number;
  plateShare: number;
  resinMl: number;
  resinGrams: number;
  layers: number;
  printHours: number;
  costs: {
    resin: number;
    electricity: number;
    wear: number;
    film: number;
    consumables: number;
    failure: number;
    work: number;
    fixed: number;
    extras: number;
  };
  cost: number;
  unpaintedPrice: number;
  paintingMultiplier: number;
  unitPrice: number;
}

/**
 * Prices one printed piece on a shared plate: the plate costs (printer time,
 * electricity, wear, consumables) are divided by the pieces that fit on it.
 */
export function calculatePrint(
  job: PrintJob,
  printer: PrintPrinter,
  settings: PrintSettings,
): PrintCalculation {
  const s = positive(job.scale) || 1;
  const sizeMm = {
    x: job.model.sizeMm.x * s,
    y: job.model.sizeMm.y * s,
    z: job.model.sizeMm.z * s,
  };
  const fitsPrinter = fits(sizeMm, printer);
  const footprint =
    (sizeMm.x + printer.spacingMm) * (sizeMm.y + printer.spacingMm);
  const usableArea =
    printer.buildXMm * printer.buildYMm * printer.plateFillRate;
  const piecesPerPlate =
    fitsPrinter && footprint > 0
      ? Math.max(1, Math.floor(usableArea / footprint))
      : 1;
  const plateShare = clampShare(job.overrides.plateShare ?? 1 / piecesPerPlate);

  const supportRate =
    job.overrides.supportRate ?? settings.material.supportRate;
  const resinMl =
    job.overrides.resinMl != null
      ? job.overrides.resinMl * s ** 3
      : job.model.volumeMl *
        s ** 3 *
        (1 + supportRate) *
        (1 + settings.material.wasteRate);
  const resinGrams = resinMl * job.resin.densityGPerMl;
  const resin = (resinGrams / 1000) * job.resin.pricePerKg;

  const layers =
    printer.layerHeightMm > 0 ? Math.ceil(sizeMm.z / printer.layerHeightMm) : 0;
  const bottomLayers = Math.min(layers, printer.bottomLayers);
  const printHours =
    job.overrides.printHours != null
      ? job.overrides.printHours * s
      : (bottomLayers * printer.bottomLayerSeconds +
          (layers - bottomLayers) * printer.secondsPerLayer) /
          3600 +
        printer.fixedMinutes / 60;
  const plateHours = printHours * plateShare;

  const electricity = plateHours * printer.electricityPerHour;
  const wear = plateHours * printer.costs.wearPerHour;
  const film = layers * printer.costs.filmPerLayer * plateShare;
  const consumables = consumablesPerPlate(settings.consumables) * plateShare;
  const failure =
    (resin + electricity + wear + film) * settings.material.failureRate;
  const work =
    (settings.work.postProcessingMinutes[job.finish] / 60) *
    settings.work.hourlyRate;
  const fixed =
    settings.fixedCosts.expectedPiecesPerMonth > 0
      ? settings.fixedCosts.monthly / settings.fixedCosts.expectedPiecesPerMonth
      : 0;
  const extras = job.extras;

  const cost =
    resin +
    electricity +
    wear +
    film +
    consumables +
    failure +
    work +
    fixed +
    extras;
  const keep = Math.max(
    0.01,
    1 - settings.price.taxRate - settings.price.paymentFeeRate,
  );
  const unpaintedPrice = roundUp(
    (cost * (1 + settings.price.markupRate)) / keep,
    settings.price.roundingStep,
  );
  const paintingMultiplier = positive(job.paintingMultiplier) || 1;

  return {
    scale: s,
    sizeMm,
    fitsPrinter,
    piecesPerPlate,
    plateShare,
    resinMl,
    resinGrams,
    layers,
    printHours,
    costs: {
      resin,
      electricity,
      wear,
      film,
      consumables,
      failure,
      work,
      fixed,
      extras,
    },
    cost: Math.round(cost),
    unpaintedPrice,
    paintingMultiplier,
    unitPrice: Math.round(unpaintedPrice * paintingMultiplier),
  };
}

/** Scale factor for a target height, or the factor itself; 1 by default. */
export function printScale(
  model: PrintModel,
  target: { heightMm?: number | null; scaleFactor?: number | null },
): number {
  if (target.heightMm != null && target.heightMm > 0 && model.sizeMm.z > 0) {
    return target.heightMm / model.sizeMm.z;
  }

  return target.scaleFactor != null && target.scaleFactor > 0
    ? target.scaleFactor
    : 1;
}

/** The piece fits the build volume, turned on the plate if needed. */
function fits(
  size: { x: number; y: number; z: number },
  printer: PrintPrinter,
): boolean {
  const flat =
    (size.x <= printer.buildXMm && size.y <= printer.buildYMm) ||
    (size.y <= printer.buildXMm && size.x <= printer.buildYMm);

  return flat && size.z <= printer.buildZMm;
}

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clampShare(share: number): number {
  return Number.isFinite(share) ? Math.min(1, Math.max(0.001, share)) : 1;
}
