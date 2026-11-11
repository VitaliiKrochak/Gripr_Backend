import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const Rate = () => applyDecorators(IsNumber(), Min(0), Max(1));
const Money = () => applyDecorators(IsInt(), Min(0));
const Minutes = () => applyDecorators(IsNumber(), Min(0), Max(1440));

export class PrintMaterialDto {
  /** Extra resin for supports and the raft, share of the model volume. */
  @IsNumber() @Min(0) @Max(3) supportRate: number;
  /** Resin left on parts, in the wash, and in the vat. */
  @Rate() wasteRate: number;
  /** Failed prints that must be reprinted, share of the print costs. */
  @Rate() failureRate: number;
}

export class PrintConsumableDto {
  @IsString()
  @MaxLength(100)
  name: string;

  /** Kopiykas per pack. */
  @Money() packPrice: number;
  /** Units in one pack. */
  @IsNumber() @Min(0.001) packSize: number;
  /** Units used per plate, shared by the pieces on it. */
  @IsNumber() @Min(0) perPlate: number;

  /** Display unit, e.g. `шт`, `мл`, `год`. */
  @IsString()
  @MaxLength(20)
  unit: string;
}

export class PostProcessingMinutesDto {
  @Minutes() raw: number;
  @Minutes() supports_removed: number;
  @Minutes() sanded: number;
}

export class PrintWorkDto {
  /** Kopiykas per hour of post-processing; 0 leaves work out of the price. */
  @Money() hourlyRate: number;

  @ValidateNested()
  @Type(() => PostProcessingMinutesDto)
  postProcessingMinutes: PostProcessingMinutesDto;
}

export class PaintingMultipliersDto {
  /** Multiplier of the unpainted price for normal painting. */
  @IsNumber() @Min(1) @Max(20) painted: number;
  /** Multiplier for complex painting. */
  @IsNumber() @Min(1) @Max(20) complex: number;
}

export class PrintModelingDto {
  /** Kopiykas per hour of 3D modeling. */
  @Money() hourlyRate: number;
  @IsInt() @Min(0) @Max(20) freeBigRevisions: number;
  @IsInt() @Min(0) @Max(20) freeSmallRevisions: number;
  /** Kopiykas per revision beyond the free ones. */
  @Money() bigRevisionPrice: number;
  @Money() smallRevisionPrice: number;
}

export class PrintFixedCostsDto {
  /** Kopiykas per month. */
  @Money() monthly: number;
  /** Sold pieces per month that share the fixed costs. */
  @IsInt() @Min(1) expectedPiecesPerMonth: number;
}

export class PrintPriceDto {
  @IsNumber() @Min(0) @Max(10) markupRate: number;
  @Rate() taxRate: number;
  /** Payment provider fee of the Lab shop. */
  @Rate() paymentFeeRate: number;
  /** Kopiykas; prices are rounded up to it. */
  @IsInt() @Min(1) roundingStep: number;
  @IsInt() @Min(0) @Max(365) productionDaysMin: number;
  @IsInt() @Min(0) @Max(365) productionDaysMax: number;
}

export class PrintBaseDto {
  /** Stable code customers' requests refer to, e.g. `round-25`. */
  @IsString()
  @Matches(/^[a-z0-9-]{1,40}$/)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  /** Kopiykas added to the cost before the markup. */
  @Money() price: number;
}

/** Gripr Lab print pricing parameters. Money in kopiykas, rates as shares. */
export class PrintSettingsDto {
  @ValidateNested() @Type(() => PrintMaterialDto) material: PrintMaterialDto;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PrintConsumableDto)
  consumables: PrintConsumableDto[];

  @ValidateNested() @Type(() => PrintWorkDto) work: PrintWorkDto;

  @ValidateNested()
  @Type(() => PaintingMultipliersDto)
  painting: PaintingMultipliersDto;

  @ValidateNested() @Type(() => PrintModelingDto) modeling: PrintModelingDto;

  @ValidateNested()
  @Type(() => PrintFixedCostsDto)
  fixedCosts: PrintFixedCostsDto;

  @ValidateNested() @Type(() => PrintPriceDto) price: PrintPriceDto;

  /** Bases offered for custom prints; omitted keeps none. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PrintBaseDto)
  bases?: PrintBaseDto[];
}
