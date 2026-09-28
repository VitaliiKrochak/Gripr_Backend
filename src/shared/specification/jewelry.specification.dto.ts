import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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
import {
  PRODUCT_TYPES,
  SPECIFICATION_MODES,
} from '../../integrations/database/database.schema';
import type {
  ProductType,
  SpecificationMode,
} from '../../integrations/database/database.schema';

/** A choice from reference data; `name` is kept as a snapshot. */
export class SpecificationChoiceDto {
  /** Reference id; the stored name is refreshed from it when set. */
  @IsOptional()
  @IsUUID()
  id?: string | null;

  @IsString()
  @MaxLength(150)
  name: string;
}

export class SpecificationEngravingDto extends SpecificationChoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  text?: string | null;
}

export class SpecificationStoneDto {
  @IsOptional()
  @IsUUID()
  gemstoneId?: string | null;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  sizeMm?: number | null;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class SpecificationExtraDto {
  @IsString()
  @MaxLength(100)
  label: string;

  @IsString()
  @MaxLength(500)
  value: string;
}

/**
 * Structured description of a bespoke piece, used for customer requests,
 * workshop proposals, and custom order items.
 */
export class JewelrySpecificationDto {
  @ApiProperty({ enum: PRODUCT_TYPES })
  @IsIn(PRODUCT_TYPES)
  productType: ProductType;

  /** `recommend`: the customer asks the workshop to choose the metal. */
  @ApiProperty({ enum: ['specified', 'recommend'] })
  @IsIn(['specified', 'recommend'])
  metalMode: 'specified' | 'recommend';

  @IsOptional()
  @ValidateNested()
  @Type(() => SpecificationChoiceDto)
  metal?: SpecificationChoiceDto | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  weightGrams?: number | null;

  /** Ring size or length in cm, depending on the product type. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  size?: number | null;

  /** `none`: no stones; `recommend`: the workshop suggests stones. */
  @ApiProperty({ enum: SPECIFICATION_MODES })
  @IsIn(SPECIFICATION_MODES)
  stoneMode: SpecificationMode;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SpecificationStoneDto)
  stones: SpecificationStoneDto[];

  /** `null` means no engraving. */
  @IsOptional()
  @ValidateNested()
  @Type(() => SpecificationEngravingDto)
  engraving?: SpecificationEngravingDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => SpecificationChoiceDto)
  coating?: SpecificationChoiceDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SpecificationChoiceDto)
  processing?: SpecificationChoiceDto[];

  /** Desired deadline, e.g. "до 14 лютого". */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  timeline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string | null;

  /** Additional requirements. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requirements?: string | null;

  /** Other agreed parameters, e.g. band width. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => SpecificationExtraDto)
  extras?: SpecificationExtraDto[];
}
