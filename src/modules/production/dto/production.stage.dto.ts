import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { STORES } from '../../../integrations/database/database.schema';
import type { Store } from '../../../integrations/database/database.schema';
import { SLUG_MESSAGE, SLUG_PATTERN } from '../../catalog/dto/reference.dto';

export class CreateProductionStageDto {
  /** Cannot be changed later; orders use only stages of their store. */
  @ApiProperty({ enum: STORES, required: false, default: 'gripr' })
  @IsOptional()
  @IsIn(STORES)
  store?: Store;

  /** Stable identifier, e.g. `casting`. */
  @Matches(SLUG_PATTERN, { message: `code ${SLUG_MESSAGE}` })
  @MaxLength(60)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  /** Customer-facing explanation shown in the order timeline. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  /** Included in the default template for catalog orders. */
  @IsOptional()
  @IsBoolean()
  defaultForCatalog?: boolean;

  /** Included in the default template for custom orders. */
  @IsOptional()
  @IsBoolean()
  defaultForCustom?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductionStageDto extends PartialType(
  OmitType(CreateProductionStageDto, ['store'] as const),
) {}

export class ProductionStageDto {
  id: string;
  @ApiProperty({ enum: STORES })
  store: Store;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  defaultForCatalog: boolean;
  defaultForCustom: boolean;
  isActive: boolean;
}
