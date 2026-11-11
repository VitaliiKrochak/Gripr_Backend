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
import { RESIN_KINDS } from '../../../integrations/database/database.schema';
import type { ResinKind } from '../../../integrations/database/database.schema';
import { SLUG_MESSAGE, SLUG_PATTERN } from '../../catalog/dto/reference.dto';

export class CreateResinDto {
  /** Stable identifier, e.g. `abs-like-grey`. */
  @Matches(SLUG_PATTERN, { message: `code ${SLUG_MESSAGE}` })
  @MaxLength(60)
  code: string;

  /** Shown to customers, e.g. `ABS-подібна смола, сіра`. */
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: RESIN_KINDS })
  @IsIn(RESIN_KINDS)
  kind: ResinKind;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  colour?: string | null;

  /** Short public text about the material. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  /** Grams per millilitre of liquid resin. */
  @IsNumber()
  @Min(0.5)
  @Max(3)
  densityGPerMl: number;

  /** Kopiykas per kilogram. */
  @IsInt()
  @Min(0)
  pricePerKg: number;

  /** The resin used when the customer chooses none; only one is the default. */
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

export class UpdateResinDto extends PartialType(CreateResinDto) {}

export class ResinDto {
  id: string;
  code: string;
  name: string;
  @ApiProperty({ enum: RESIN_KINDS })
  kind: ResinKind;
  colour: string | null;
  description: string | null;
  densityGPerMl: number;
  pricePerKg: number;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

/** What customers see about a resin; the price stays internal. */
export class StorefrontResinDto {
  /** Sent as 
esinId in print and custom requests. */
  id: string;
  code: string;
  name: string;
  @ApiProperty({ enum: RESIN_KINDS })
  kind: ResinKind;
  colour: string | null;
  description: string | null;
  isDefault: boolean;
}
