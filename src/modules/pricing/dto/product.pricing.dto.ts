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
import { PRICING_MODES } from '../../../integrations/database/database.schema';
import type { PricingMode } from '../../../integrations/database/database.schema';
import {
  LABOR_TYPES,
  PRICING_SCENARIOS,
  SERVICE_CATEGORIES,
  WORKERS,
} from '../pricing.settings';
import type {
  LaborType,
  PricingScenario,
  ServiceCategory,
  Worker,
} from '../pricing.settings';

export class PricingServiceInputDto {
  /** Preset code from the pricing settings; `null` for a custom service. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  code: string | null = null;

  @ApiProperty({ enum: SERVICE_CATEGORIES })
  @IsIn(SERVICE_CATEGORIES)
  category: ServiceCategory;

  @IsString()
  @MaxLength(150)
  name: string;

  /** Pieces, grams, cm³ for wax print, or 1 for a fixed price. */
  @IsNumber()
  @Min(0)
  quantity: number;

  /** Kopiykas per unit; `null` uses the preset or the wax print tier. */
  @IsOptional()
  @IsInt()
  @Min(0)
  unitCost: number | null = null;

  @IsOptional()
  @IsInt()
  @Min(0)
  unitPrice: number | null = null;

  /** Outside contractors get the scenario markup on top of the price. */
  @IsOptional()
  @IsBoolean()
  external = false;
}

export class PricingFittingInputDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsInt()
  @Min(0)
  unitCost: number;

  /** `null` applies the fittings markup to the cost. */
  @IsOptional()
  @IsInt()
  @Min(0)
  unitPrice: number | null = null;
}

/** Manual replacements of automatic values; `null` keeps the automatic one. */
export class PricingOverridesDto {
  /** Alloy price, kopiykas per gram. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  alloyPricePerGram: number | null = null;

  /** Margin per finished gram, kopiykas. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  marginPerGram: number | null = null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.9)
  lossRate: number | null = null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  metalBuffer: number | null = null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  externalMarkup: number | null = null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  overhead: number | null = null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  risk: number | null = null;

  /** Kopiykas. */
  @IsOptional()
  @IsInt()
  @Min(0)
  roundingStep: number | null = null;

  /** Kopiykas. */
  @IsOptional()
  @IsInt()
  @Min(0)
  minProfit: number | null = null;
}

/** Price calculator inputs of a catalog product. */
export class ProductPricingDto {
  /** `auto` recalculates prices; `manual` keeps hand-entered prices. */
  @ApiProperty({ enum: PRICING_MODES })
  @IsIn(PRICING_MODES)
  mode: PricingMode;

  /** Metal priced when the product has no metal option group. */
  @IsOptional()
  @IsUUID()
  metalId: string | null = null;

  @ApiProperty({ enum: LABOR_TYPES })
  @IsIn(LABOR_TYPES)
  laborType: LaborType;

  @IsNumber()
  @Min(0)
  @Max(1000)
  laborHours: number;

  @ApiProperty({ enum: WORKERS })
  @IsIn(WORKERS)
  jeweler: Worker;

  /** Who sets the stones; an owner keeps the setting margin as pay. */
  @ApiProperty({ enum: WORKERS })
  @IsIn(WORKERS)
  setter: Worker;

  /** `null` uses the default scenario of the settings. */
  @ApiProperty({ enum: PRICING_SCENARIOS, nullable: true, required: false })
  @IsOptional()
  @IsIn(PRICING_SCENARIOS)
  scenario: PricingScenario | null = null;

  /** Rush surcharge, fraction of the price. */
  @IsNumber()
  @Min(0)
  @Max(5)
  urgency: number;

  /** Fixed extra profit, kopiykas. */
  @IsInt()
  @Min(0)
  extraProfit: number;

  /** Kopiykas; `null` uses the settings default. */
  @IsOptional()
  @IsInt()
  @Min(0)
  delivery: number | null = null;

  @IsOptional()
  @IsInt()
  @Min(0)
  packaging: number | null = null;

  @IsOptional()
  @IsInt()
  @Min(0)
  consumables: number | null = null;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PricingServiceInputDto)
  services: PricingServiceInputDto[];

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PricingFittingInputDto)
  fittings: PricingFittingInputDto[];

  @ValidateNested()
  @Type(() => PricingOverridesDto)
  overrides: PricingOverridesDto;
}
