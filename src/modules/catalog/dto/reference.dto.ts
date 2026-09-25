import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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

  /** Hallmark, e.g. `585`. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  purity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

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
  purity: string | null;
  color: string | null;
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
