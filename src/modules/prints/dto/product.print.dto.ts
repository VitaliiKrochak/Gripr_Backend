import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PRICING_MODES } from '../../../integrations/database/database.schema';
import type { PricingMode } from '../../../integrations/database/database.schema';

/** Bounding box in millimetres; `z` is the height as printed. */
export class PrintSizeDto {
  @IsNumber() @Min(0.1) @Max(2000) x: number;
  @IsNumber() @Min(0.1) @Max(2000) y: number;
  @IsNumber() @Min(0.1) @Max(2000) z: number;
}

/** Slicer values at the reference size; omitted or `null` calculates them. */
export class PrintOverridesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(3)
  supportRate?: number | null;

  /** Resin with supports, ml; other sizes scale it by `s³`. */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100000)
  resinMl?: number | null;

  /** Hours of one print; other sizes scale it by `s`. */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  printHours?: number | null;

  /** Share of the plate; 1 prints the piece alone. */
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  @Max(1)
  plateShare?: number | null;
}

/** Print calculator inputs of a Lab product at its reference size. */
export class ProductPrintDto {
  /** `auto` prices every selection with the print calculator. */
  @ApiProperty({ enum: PRICING_MODES })
  @IsIn(PRICING_MODES)
  mode: PricingMode;

  /**
   * Analyzed staff model file of this product (`POST /print-files`). When
   * set, `volumeMl` and `sizeMm` are taken from it when the product is saved.
   */
  @IsOptional()
  @IsUUID()
  printFileId?: string | null;

  /** Model volume in ml (1 cm³ = 1 ml), without supports. */
  @ValidateIf((print: ProductPrintDto) => !print.printFileId)
  @IsNumber()
  @Min(0.01)
  @Max(100000)
  volumeMl: number;

  @ValidateIf((print: ProductPrintDto) => !print.printFileId)
  @ValidateNested()
  @Type(() => PrintSizeDto)
  sizeMm: PrintSizeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PrintOverridesDto)
  overrides?: PrintOverridesDto;
}
