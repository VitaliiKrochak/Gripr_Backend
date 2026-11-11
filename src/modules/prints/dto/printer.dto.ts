import { applyDecorators } from '@nestjs/common';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SLUG_MESSAGE, SLUG_PATTERN } from '../../catalog/dto/reference.dto';
import { COST_CURRENCIES } from '../printer.costs';
import type { CostCurrency } from '../printer.costs';

const Positive = (max: number) =>
  applyDecorators(IsNumber(), Min(0.001), Max(max));
const Count = () => applyDecorators(IsInt(), Min(0));

export class CreatePrinterDto {
  /** Stable identifier, e.g. `saturn-4-ultra-16k`. */
  @Matches(SLUG_PATTERN, { message: `code ${SLUG_MESSAGE}` })
  @MaxLength(60)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  /** Build volume in millimetres. */
  @Positive(2000) buildXMm: number;
  @Positive(2000) buildYMm: number;
  @Positive(2000) buildZMm: number;

  @Positive(1) layerHeightMm: number;
  /** Average time of a normal layer, exposure and lift included. */
  @Positive(600) secondsPerLayer: number;
  @Count() bottomLayers: number;
  @IsNumber() @Min(0) @Max(600) bottomLayerSeconds: number;
  /** Heating, homing, and draining per print. */
  @IsNumber() @Min(0) @Max(600) fixedMinutes: number;

  /** Currency of `price`, `lcdPrice`, and `filmPrice`. */
  @ApiProperty({ enum: COST_CURRENCIES })
  @IsIn(COST_CURRENCIES)
  costCurrency: CostCurrency;

  /** Minor units of `costCurrency` (cents or kopiykas). */
  @Count() price: number;
  /** Expected printing hours before the printer is replaced. */
  @IsInt() @Min(1) lifetimeHours: number;
  @Count() lcdPrice: number;
  @IsInt() @Min(1) lcdLifetimeHours: number;
  /** One release film. */
  @Count() filmPrice: number;
  @IsInt() @Min(1) layersPerFilm: number;

  /** Kopiykas per printing hour. */
  @Count() electricityPerHour: number;

  /** Share of the plate area pieces can use. */
  @IsNumber() @Min(0.05) @Max(1) plateFillRate: number;
  /** Gap around every piece on the plate. */
  @IsNumber() @Min(0) @Max(100) spacingMm: number;

  /** Customer estimates and catalog prices use the default printer. */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdatePrinterDto extends PartialType(CreatePrinterDto) {}

export class PrinterCostsDto {
  /** Kopiykas, converted at the current USD rate for USD prices. */
  price: number;
  lcdPrice: number;
  filmPrice: number;
  /** Kopiykas of printer and LCD depreciation per printing hour. */
  wearPerHour: number;
  /** Kopiykas of release film wear per layer. */
  filmPerLayer: number;
}

export class PrinterDto {
  id: string;
  code: string;
  name: string;
  buildXMm: number;
  buildYMm: number;
  buildZMm: number;
  layerHeightMm: number;
  secondsPerLayer: number;
  bottomLayers: number;
  bottomLayerSeconds: number;
  fixedMinutes: number;
  @ApiProperty({ enum: COST_CURRENCIES })
  costCurrency: CostCurrency;
  price: number;
  lifetimeHours: number;
  lcdPrice: number;
  lcdLifetimeHours: number;
  filmPrice: number;
  layersPerFilm: number;
  electricityPerHour: number;
  plateFillRate: number;
  spacingMm: number;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  /** UAH per USD used for `costs`. */
  usdRate: number;
  costs: PrinterCostsDto;
}
