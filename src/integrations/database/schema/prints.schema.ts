import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { COST_CURRENCIES } from '../../../modules/prints/printer.costs';
import type { PrintOverrides } from '../../../modules/prints/print.pricing';
import { PRINT_FINISHES } from '../../../modules/prints/print.settings';
import type { PrintSettings } from '../../../modules/prints/print.settings';
import { appSchema, timestamps } from './common.schema';
import type { PricingMode } from './pricing.schema';

/** Print calculator inputs of a Lab product, at its reference size. */
export interface ProductPrint {
  /** `auto` prices every selection with the print calculator. */
  mode: PricingMode;
  volumeMl: number;
  sizeMm: { x: number; y: number; z: number };
  overrides: PrintOverrides;
  /** Staff model file the volume and size were taken from. */
  printFileId: string | null;
}

export const printFinish = appSchema.enum('print_finish', PRINT_FINISHES);

export const RESIN_KINDS = [
  'standard',
  'abs_like',
  'tough',
  'water_washable',
  'flexible',
  'castable',
  'clear',
  'other',
] as const;
export type ResinKind = (typeof RESIN_KINDS)[number];

export const resinKind = appSchema.enum('resin_kind', RESIN_KINDS);
export const costCurrency = appSchema.enum('cost_currency', COST_CURRENCIES);

/** Gripr Lab printing resins; the type and colour are shown to customers. */
export const resins = appSchema.table('resins', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  kind: resinKind('kind').notNull(),
  colour: text('colour'),
  description: text('description'),
  densityGPerMl: doublePrecision('density_g_per_ml').notNull(),
  /** Kopiykas per kilogram. */
  pricePerKg: integer('price_per_kg').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

/** Gripr Lab resin printers with the figures the print calculator uses. */
export const printers = appSchema.table('printers', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  buildXMm: doublePrecision('build_x_mm').notNull(),
  buildYMm: doublePrecision('build_y_mm').notNull(),
  buildZMm: doublePrecision('build_z_mm').notNull(),
  layerHeightMm: doublePrecision('layer_height_mm').notNull(),
  secondsPerLayer: doublePrecision('seconds_per_layer').notNull(),
  bottomLayers: integer('bottom_layers').notNull(),
  bottomLayerSeconds: doublePrecision('bottom_layer_seconds').notNull(),
  /** Heating, homing, and draining per print. */
  fixedMinutes: doublePrecision('fixed_minutes').notNull(),
  /** Currency of `price`, `lcdPrice`, and `filmPrice`, in minor units. */
  costCurrency: costCurrency('cost_currency').notNull(),
  price: integer('price').notNull(),
  lifetimeHours: integer('lifetime_hours').notNull(),
  lcdPrice: integer('lcd_price').notNull(),
  lcdLifetimeHours: integer('lcd_lifetime_hours').notNull(),
  filmPrice: integer('film_price').notNull(),
  layersPerFilm: integer('layers_per_film').notNull(),
  /** Kopiykas per printing hour. */
  electricityPerHour: integer('electricity_per_hour').notNull(),
  /** Share of the plate area pieces can use. */
  plateFillRate: doublePrecision('plate_fill_rate').notNull(),
  spacingMm: doublePrecision('spacing_mm').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

/** Gripr Lab print pricing parameters; a single row with id `default`. */
export const printSettings = appSchema.table('print_settings', {
  id: text('id').primaryKey(),
  settings: jsonb('settings').$type<PrintSettings>().notNull(),
  ...timestamps,
});

export type Resin = typeof resins.$inferSelect;
export type Printer = typeof printers.$inferSelect;
