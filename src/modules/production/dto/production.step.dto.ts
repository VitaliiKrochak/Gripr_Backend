import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PRODUCTION_STEP_STATES } from '../../../integrations/database/database.schema';
import type { ProductionStepState } from '../../../integrations/database/database.schema';
import { ImageAssetDto } from '../../../shared/media/image.asset.dto';

export class CreateProductionStepsDto {
  /**
   * Stages to add, in any order. When omitted, the active stages marked as
   * default for the order kind (catalog or custom) are used.
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsUUID('4', { each: true })
  stageIds?: string[];
}

export class ReorderProductionStepsDto {
  /** Step ids in the desired order. */
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  ids: string[];
}

export class UpdateProductionStepDto {
  @IsOptional()
  @ApiProperty({ enum: PRODUCTION_STEP_STATES, required: false })
  @IsIn(PRODUCTION_STEP_STATES)
  state?: ProductionStepState;

  /** Shown to the customer when the step is visible. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  /** Progress photos uploaded to the `production` media folder. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ImageAssetDto)
  images?: ImageAssetDto[];

  @IsOptional()
  @IsBoolean()
  visibleToCustomer?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
