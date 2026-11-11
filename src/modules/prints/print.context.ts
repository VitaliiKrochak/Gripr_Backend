import { BadRequestException } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../integrations/database/database.client';
import {
  printers,
  printFiles,
  printSettings,
  resins,
} from '../../integrations/database/database.schema';
import type {
  Printer,
  ProductPrint,
  Resin,
} from '../../integrations/database/database.schema';
import { ConfigurationError } from '../catalog/product.configuration';
import type {
  ConfigurableProduct,
  ConfigurableValue,
} from '../catalog/product.configuration';
import { readUsdRate } from '../pricing/usd.rate';
import { printerCosts } from './printer.costs';
import { calculatePrint, printScale } from './print.pricing';
import type { PrintCalculation, PrintJob, PrintPrinter } from './print.pricing';
import { mergePrintSettings } from './print.settings';
import type { PrintSettings } from './print.settings';

/** Finish of a piece when the product has no finish choice. */
export const DEFAULT_PRINT_FINISH = 'supports_removed';

export interface PrintContext {
  settings: PrintSettings;
  usdRate: number;
  /** The printer prices are calculated for; `null` when none is set up. */
  printer: (PrintPrinter & { id: string; name: string }) | null;
  resins: Map<string, Resin>;
  defaultResin: Resin | null;
}

/**
 * Loads what the print calculator needs: settings, the USD rate, resins, and
 * the given printer or else the default (else the first active) printer.
 */
export async function loadPrintContext(
  executor: DatabaseExecutor,
  printerId?: string,
): Promise<PrintContext> {
  const [[settingsRow], usdRate, resinRows, [printer]] = await Promise.all([
    executor
      .select({ settings: printSettings.settings })
      .from(printSettings)
      .where(eq(printSettings.id, 'default')),
    readUsdRate(executor),
    executor.select().from(resins),
    executor
      .select()
      .from(printers)
      .where(
        printerId ? eq(printers.id, printerId) : eq(printers.isActive, true),
      )
      .orderBy(desc(printers.isDefault), asc(printers.sortOrder))
      .limit(1),
  ]);

  return {
    settings: mergePrintSettings(settingsRow?.settings),
    usdRate,
    printer: printer ? toPrintPrinter(printer, usdRate) : null,
    resins: new Map(resinRows.map((row) => [row.id, row])),
    defaultResin:
      resinRows.find((row) => row.isDefault && row.isActive) ?? null,
  };
}

export function toPrintPrinter(
  printer: Printer,
  usdRate: number,
): PrintPrinter & { id: string; name: string } {
  return { ...printer, costs: printerCosts(printer, usdRate) };
}

/** Print calculator job for the selected values of a print-priced product. */
export function printJob(
  print: ProductPrint,
  selected: ConfigurableValue[],
  ctx: PrintContext,
): PrintJob {
  const model = { volumeMl: print.volumeMl, sizeMm: print.sizeMm };
  const scale = selected.find(
    (value) => value.heightMm != null || value.scaleFactor != null,
  );
  const resinValue = selected.find((value) => value.resinId);
  const resin = resinValue
    ? ctx.resins.get(resinValue.resinId!)
    : (ctx.defaultResin ?? undefined);

  if (!resin) {
    throw new ConfigurationError('Choose a resin');
  }

  if (!resin.isActive) {
    throw new ConfigurationError(`"${resin.name}" is not available`);
  }

  return {
    model,
    scale: scale ? printScale(model, scale) : 1,
    resin,
    finish:
      selected.find((value) => value.printFinish)?.printFinish ??
      DEFAULT_PRINT_FINISH,
    paintingMultiplier:
      selected.find((value) => value.paintingMultiplier != null)
        ?.paintingMultiplier ?? 1,
    extras: selected.reduce((sum, value) => sum + value.priceDelta, 0),
    overrides: print.overrides,
  };
}

export function calculateSelection(
  print: ProductPrint,
  selected: ConfigurableValue[],
  ctx: PrintContext,
): PrintCalculation {
  if (!ctx.printer) {
    throw new ConfigurationError('Lab printing is not set up yet');
  }

  return calculatePrint(
    printJob(print, selected, ctx),
    ctx.printer,
    ctx.settings,
  );
}

/** Stored form of the print inputs: missing overrides become `null`. */
export function toProductPrint(input: {
  mode: ProductPrint['mode'];
  volumeMl: number;
  sizeMm: ProductPrint['sizeMm'];
  overrides?: Partial<ProductPrint['overrides']>;
  printFileId?: string | null;
}): ProductPrint {
  const overrides = input.overrides ?? {};

  return {
    mode: input.mode,
    volumeMl: input.volumeMl,
    sizeMm: { x: input.sizeMm.x, y: input.sizeMm.y, z: input.sizeMm.z },
    overrides: {
      supportRate: overrides.supportRate ?? null,
      resinMl: overrides.resinMl ?? null,
      printHours: overrides.printHours ?? null,
      plateShare: overrides.plateShare ?? null,
    },
    printFileId: input.printFileId ?? null,
  };
}

/**
 * Stored print inputs of a product; with `printFileId` the volume and size
 * come from that measured staff file of the product.
 */
export async function resolveProductPrint(
  executor: DatabaseExecutor,
  productId: string | null,
  input: Parameters<typeof toProductPrint>[0],
): Promise<ProductPrint> {
  if (!input.printFileId) {
    return toProductPrint(input);
  }

  if (!productId) {
    throw new BadRequestException(
      'Upload the model file after the product is created',
    );
  }

  const [file] = await executor
    .select({
      productId: printFiles.productId,
      volumeMl: printFiles.volumeMl,
      sizeMm: printFiles.sizeMm,
    })
    .from(printFiles)
    .where(eq(printFiles.id, input.printFileId));

  if (!file || file.productId !== productId) {
    throw new BadRequestException(
      'The model file does not belong to this product',
    );
  }

  if (file.volumeMl === null || !file.sizeMm) {
    throw new BadRequestException('The model file has not been measured yet');
  }

  return toProductPrint({
    ...input,
    volumeMl: file.volumeMl,
    sizeMm: file.sizeMm,
  });
}

export function isPrintPriced(product: {
  print?: ProductPrint | null;
}): product is { print: ProductPrint } {
  return product.print?.mode === 'auto';
}

/**
 * Prices a print-priced product per selection with the calculator; its
 * production time comes from the print settings. Other products are
 * returned unchanged.
 */
export function withPrintPricing<
  T extends ConfigurableProduct & { print?: ProductPrint | null },
>(product: T, ctx: PrintContext | null): PrintPriced<T> {
  if (!isPrintPriced(product) || !ctx) {
    return product;
  }

  const print = product.print;

  return {
    ...product,
    productionDaysMin: ctx.settings.price.productionDaysMin,
    productionDaysMax: ctx.settings.price.productionDaysMax,
    selectionPrice: (selected: ConfigurableValue[]) =>
      calculateSelection(print, selected, ctx).unitPrice,
  };
}

export type PrintPriced<T> = T & Pick<ConfigurableProduct, 'selectionPrice'>;

/** Loads the print context only when one of the products needs it. */
export async function printContextFor(
  executor: DatabaseExecutor,
  rows: Array<{ print?: ProductPrint | null }>,
): Promise<PrintContext | null> {
  return rows.some((row) => isPrintPriced(row))
    ? loadPrintContext(executor)
    : null;
}
