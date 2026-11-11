import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { STORE_OPTION_KINDS } from '../../catalog/product.stores';
import { PRINT_FINISHES } from '../print.settings';
import type { PrintFinish } from '../print.settings';
import {
  PrintOverridesDto,
  PrintSizeDto,
  ProductPrintDto,
} from './product.print.dto';

const LAB_OPTION_KINDS = STORE_OPTION_KINDS.lab;
type LabOptionKind = (typeof LAB_OPTION_KINDS)[number];

export class PrintCalculateRequestDto {
  /** Model volume in ml at the reference size, without supports. */
  @IsNumber()
  @Min(0.01)
  @Max(100000)
  volumeMl: number;

  @ValidateNested()
  @Type(() => PrintSizeDto)
  sizeMm: PrintSizeDto;

  /** Finished height in mm; wins over `scaleFactor`. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(2000)
  heightMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  scaleFactor?: number;

  /** Defaults to the default resin. */
  @IsOptional()
  @IsUUID()
  resinId?: string;

  /** Defaults to the default printer. */
  @IsOptional()
  @IsUUID()
  printerId?: string;

  @ApiProperty({ enum: PRINT_FINISHES, required: false })
  @IsOptional()
  @IsIn(PRINT_FINISHES)
  finish?: PrintFinish;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  paintingMultiplier?: number;

  /** Kopiykas added to the cost, e.g. a base. */
  @IsOptional()
  @IsInt()
  @Min(0)
  extras?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PrintOverridesDto)
  overrides?: PrintOverridesDto;
}

export class PrintReferenceDto {
  id: string;
  name: string;
}

export class PrintCostLinesDto {
  resin: number;
  electricity: number;
  /** Printer and LCD depreciation. */
  wear: number;
  /** Release film wear per layer. */
  film: number;
  consumables: number;
  failure: number;
  work: number;
  fixed: number;
  extras: number;
}

/** One piece; cost lines are unrounded kopiykas. */
export class PrintCalculationDto {
  scale: number;
  sizeMm: PrintSizeDto;
  /** The scaled piece fits the build volume. */
  fitsPrinter: boolean;
  piecesPerPlate: number;
  plateShare: number;
  resinMl: number;
  resinGrams: number;
  layers: number;
  printHours: number;
  costs: PrintCostLinesDto;
  cost: number;
  unpaintedPrice: number;
  paintingMultiplier: number;
  unitPrice: number;
}

export class PrintCalculateResultDto {
  printer: PrintReferenceDto;
  resin: PrintReferenceDto;
  /** UAH per USD used for printer prices. */
  usdRate: number;
  calculation: PrintCalculationDto;
  quantity: number;
  total: number;
  productionDaysMin: number;
  productionDaysMax: number;
}

export class PrintPreviewValueDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(2000)
  heightMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  scaleFactor?: number | null;

  @IsOptional()
  @IsUUID()
  resinId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  paintingMultiplier?: number | null;

  @ApiProperty({ enum: PRINT_FINISHES, required: false, nullable: true })
  @IsOptional()
  @IsIn(PRINT_FINISHES)
  printFinish?: PrintFinish | null;

  @IsOptional()
  @IsInt()
  priceDelta?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class PrintPreviewGroupDto {
  @ApiProperty({ enum: LAB_OPTION_KINDS })
  @IsIn(LAB_OPTION_KINDS)
  kind: LabOptionKind;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PrintPreviewValueDto)
  values: PrintPreviewValueDto[];
}

/** An unsaved Lab product, as in the editor. */
export class PrintProductPreviewRequestDto {
  @ValidateNested()
  @Type(() => ProductPrintDto)
  print: ProductPrintDto;

  /** Defaults to the default printer. */
  @IsOptional()
  @IsUUID()
  printerId?: string;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PrintPreviewGroupDto)
  optionGroups: PrintPreviewGroupDto[];
}

export class PrintPreviewChoiceDto {
  groupIndex: number;
  valueIndex: number;
  label: string;
}

export class PrintCombinationDto {
  /** One choice per group in the combination; optional groups may be left out. */
  choices: PrintPreviewChoiceDto[];
  @ApiProperty({ type: PrintCalculationDto, nullable: true })
  calculation: PrintCalculationDto | null;
  /** Why the combination cannot be priced, e.g. an inactive resin. */
  error: string | null;
}

export class PrintProductPreviewDto {
  printer: PrintReferenceDto;
  usdRate: number;
  /** Card price: the cheapest combination of the required groups. */
  priceFrom: number;
  productionDaysMin: number;
  productionDaysMax: number;
  combinations: PrintCombinationDto[];
  /** More combinations exist than are listed. */
  truncated: boolean;
}
