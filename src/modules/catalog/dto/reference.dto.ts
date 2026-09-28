import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  FINISHING_KINDS,
  METAL_FAMILIES,
} from '../../../integrations/database/database.schema';
import type {
  FinishingKind,
  MetalFamily,
} from '../../../integrations/database/database.schema';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MESSAGE =
  'must contain lowercase latin letters, digits, and single hyphens';

export class CreateMetalDto {
  /** Stable identifier used in storefront filters, e.g. `gold-585-yellow`. */
  @Matches(SLUG_PATTERN, { message: `code ${SLUG_MESSAGE}` })
  @MaxLength(60)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: METAL_FAMILIES, required: false })
  @IsOptional()
  @IsIn(METAL_FAMILIES)
  family?: MetalFamily;

  /** Hallmark, e.g. `585`. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  purity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  /**
   * Kopiykas per gram used to price products by weight; `null` leaves the
   * metal out of automatic pricing.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  pricePerGram?: number | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMetalDto extends PartialType(CreateMetalDto) {}

export class MetalDto {
  id: string;
  code: string;
  name: string;
  @ApiProperty({ enum: METAL_FAMILIES })
  family: MetalFamily;
  purity: string | null;
  color: string | null;
  pricePerGram: number | null;
  sortOrder: number;
  isActive: boolean;
}

export class CreateGemstoneDto {
  @Matches(SLUG_PATTERN, { message: `code ${SLUG_MESSAGE}` })
  @MaxLength(60)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateGemstoneDto extends PartialType(CreateGemstoneDto) {}

export class GemstoneDto {
  id: string;
  code: string;
  name: string;
  color: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export class CreateFinishingOptionDto {
  @Matches(SLUG_PATTERN, { message: `code ${SLUG_MESSAGE}` })
  @MaxLength(60)
  code: string;

  @ApiProperty({ enum: FINISHING_KINDS })
  @IsIn(FINISHING_KINDS)
  kind: FinishingKind;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Suggested surcharge in kopiykas when added to a product. */
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  productionDays?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFinishingOptionDto extends PartialType(
  CreateFinishingOptionDto,
) {}

/** Engraving, coating, or processing operation offered by the workshop. */
export class FinishingOptionDto {
  id: string;
  code: string;
  @ApiProperty({ enum: FINISHING_KINDS })
  kind: FinishingKind;
  name: string;
  description: string | null;
  defaultPrice: number;
  productionDays: number;
  sortOrder: number;
  isActive: boolean;
}

export class CreateTagDto {
  @Matches(SLUG_PATTERN, { message: `slug ${SLUG_MESSAGE}` })
  @MaxLength(60)
  slug: string;

  @IsString()
  @MaxLength(100)
  name: string;

  /** Optional grouping for filters, e.g. `style` or `occasion`. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  group?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateTagDto extends PartialType(CreateTagDto) {}

export class TagDto {
  id: string;
  slug: string;
  name: string;
  group: string | null;
  sortOrder: number;
}
