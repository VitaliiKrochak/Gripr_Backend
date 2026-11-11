import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  PRINT_FILE_STATUSES,
  PRINT_REQUEST_STATUSES,
} from '../../../integrations/database/database.schema';
import type {
  PrintFileStatus,
  PrintRequestStatus,
} from '../../../integrations/database/database.schema';
import { PaginationQueryDto } from '../../../shared/pagination/pagination.query.dto';
import { PRINT_FINISHES } from '../print.settings';
import type { PrintFinish } from '../print.settings';
import { PrintCalculationDto, PrintReferenceDto } from './print.pricing.dto';
import { PrintOverridesDto, PrintSizeDto } from './product.print.dto';

export const MAX_PRINT_REQUEST_ITEMS = 20;
export const MAX_PRINT_QUANTITY = 50;

/** One of my uploaded models with how to print it. */
export class PrintRequestItemInputDto {
  /** My model file (`POST /api/customers/me/print-files`). */
  @IsUUID()
  fileId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PRINT_QUANTITY)
  quantity?: number;

  /** Printed height in mm; leave both height and factor out for the file size. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(2000)
  heightMm?: number;

  /** Scale of the file, e.g. 0.5; not together with `heightMm`. */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  scaleFactor?: number;

  /** An active resin (`GET /api/storefront/resins`); defaults to the default one. */
  @IsOptional()
  @IsUUID()
  resinId?: string;

  @ApiProperty({ enum: PRINT_FINISHES, required: false })
  @IsOptional()
  @IsIn(PRINT_FINISHES)
  finish?: PrintFinish;

  @IsOptional()
  @IsBoolean()
  painted?: boolean;

  /** A base from `GET /api/storefront/print-options`. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  baseCode?: string;
}

class PrintRequestItemsInputDto {
  /** Replaces all items; at most 20. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRINT_REQUEST_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => PrintRequestItemInputDto)
  items?: PrintRequestItemInputDto[];
}

export class CreatePrintRequestDto extends PrintRequestItemsInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  /** I may have these models printed (my own or licensed models). */
  @IsOptional()
  @IsBoolean()
  rightsConfirmed?: boolean;
}

export class UpdatePrintRequestDto extends CreatePrintRequestDto {}

export class PrintQuoteRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PRINT_REQUEST_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => PrintRequestItemInputDto)
  items: PrintRequestItemInputDto[];
}

/** Staff adjustments of one item; `null` returns to the calculated value. */
export class AdminPrintRequestItemInputDto {
  @IsUUID()
  id: string;

  /** Printer to price on; `null` is the default printer. */
  @IsOptional()
  @IsUUID()
  printerId?: string | null;

  /** Painting multiplier, e.g. 3 for complex painting. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  paintingMultiplier?: number | null;

  /** Slicer values at the printed size. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PrintOverridesDto)
  overrides?: PrintOverridesDto | null;
}

export class AdminUpdatePrintRequestDto {
  /** Shown to the customer. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  staffNote?: string | null;

  /** Defaults to the print settings when the price is confirmed. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  productionDaysMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  productionDaysMax?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRINT_REQUEST_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => AdminPrintRequestItemInputDto)
  items?: AdminPrintRequestItemInputDto[];
}

export class PrintRequestNoteDto {
  /** Shown to the customer and posted to the request conversation. */
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  note: string;
}

export class AdminPrintRequestListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @ApiProperty({ enum: PRINT_REQUEST_STATUSES, required: false })
  @IsIn(PRINT_REQUEST_STATUSES)
  status?: PrintRequestStatus;
}

export class PrintBaseOptionDto {
  code: string;
  name: string;
}

export class PrintRequestFileDto {
  id: string;
  @ApiProperty({ enum: PRINT_FILE_STATUSES })
  status: PrintFileStatus;
  volumeMl: number | null;
  sizeMm: PrintSizeDto | null;
}

export class PrintItemPriceDto {
  /** Kopiykas per piece; `null` when `priceError` explains why. */
  unitPrice: number | null;
  lineTotal: number | null;
  priceError: string | null;
  /** Printed size in mm. */
  @ApiProperty({ type: PrintSizeDto, nullable: true })
  sizeMm: PrintSizeDto | null;
  /** The printed piece fits the printer; staff split it otherwise. */
  fitsPrinter: boolean | null;
}

export class PrintRequestItemDto extends PrintItemPriceDto {
  id: string;
  /** `null` once the file was deleted. */
  @ApiProperty({ type: PrintRequestFileDto, nullable: true })
  file: PrintRequestFileDto | null;
  fileName: string;
  quantity: number;
  heightMm: number | null;
  scaleFactor: number | null;
  @ApiProperty({ type: PrintReferenceDto, nullable: true })
  resin: PrintReferenceDto | null;
  @ApiProperty({ enum: PRINT_FINISHES })
  finish: PrintFinish;
  painted: boolean;
  @ApiProperty({ type: PrintBaseOptionDto, nullable: true })
  base: PrintBaseOptionDto | null;
}

export class PrintRequestDto {
  id: string;
  @ApiProperty({ enum: PRINT_REQUEST_STATUSES })
  status: PrintRequestStatus;
  comment: string | null;
  rightsConfirmed: boolean;
  @ApiProperty({ type: [PrintRequestItemDto] })
  items: PrintRequestItemDto[];
  /** Kopiykas; `null` while some item has no automatic price. */
  estimate: number | null;
  /** Kopiykas confirmed by staff; what the customer pays. */
  confirmedPrice: number | null;
  confirmedAt: Date | null;
  /** Add the print to the cart before this; then staff check the price again. */
  priceValidUntil: Date | null;
  /** What to change or why the request was rejected. */
  staffNote: string | null;
  productionDaysMin: number | null;
  productionDaysMax: number | null;
  orderId: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AdminPrintRequestItemDto extends PrintRequestItemDto {
  printerId: string | null;
  paintingMultiplier: number | null;
  @ApiProperty({ type: PrintOverridesDto, nullable: true })
  overrides: PrintOverridesDto | null;
  /** Base price in kopiykas, from the snapshot taken when chosen. */
  basePrice: number | null;
  @ApiProperty({ type: PrintCalculationDto, nullable: true })
  calculation: PrintCalculationDto | null;
}

export class AdminPrintRequestDto extends PrintRequestDto {
  customerId: string;
  @ApiProperty({ type: [AdminPrintRequestItemDto] })
  declare items: AdminPrintRequestItemDto[];
}

export class PrintQuoteDto {
  @ApiProperty({ type: [PrintItemPriceDto] })
  items: PrintItemPriceDto[];
  /** Kopiykas; `null` while some item has no automatic price. */
  estimate: number | null;
}

export class PrintRequestPageDto {
  @ApiProperty({ type: [PrintRequestDto] })
  items: PrintRequestDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class AdminPrintRequestPageDto {
  @ApiProperty({ type: [AdminPrintRequestDto] })
  items: AdminPrintRequestDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class PrintOptionsDto {
  /** Bases customers can add to a print. */
  @ApiProperty({ type: [PrintBaseOptionDto] })
  bases: PrintBaseOptionDto[];
  @ApiProperty({ enum: PRINT_FINISHES, isArray: true })
  finishes: PrintFinish[];
  /** Upload limit per model file in bytes. */
  maxFileBytes: number;
  maxItems: number;
  maxQuantity: number;
  /** Days a confirmed price is valid. */
  priceValidDays: number;
}
