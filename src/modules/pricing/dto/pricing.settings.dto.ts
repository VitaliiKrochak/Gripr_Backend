import { applyDecorators } from '@nestjs/common';
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
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PRICING_SCENARIOS,
  SERVICE_CATEGORIES,
  SERVICE_UNITS,
} from '../pricing.settings';
import type {
  PricingScenario,
  ServiceCategory,
  ServiceUnit,
} from '../pricing.settings';

const Rate = () => applyDecorators(IsNumber(), Min(0), Max(1));
const Money = () => applyDecorators(IsInt(), Min(0));
const Factor = () => applyDecorators(IsNumber(), Min(0), Max(10));

export class ScenarioRatesDto {
  /** Buffer against metal price changes, share of the metal cost. */
  @Rate() metalBuffer: number;
  /** Markup on outside services such as casting and coating. */
  @Rate() externalMarkup: number;
  /** Small tools, power, and equipment wear, share of direct costs. */
  @Rate() overhead: number;
  /** Reserve for recasting and defects, share of material costs. */
  @Rate() risk: number;
}

export class ScenariosDto {
  @ValidateNested() @Type(() => ScenarioRatesDto) minimal: ScenarioRatesDto;
  @ValidateNested() @Type(() => ScenarioRatesDto) recommended: ScenarioRatesDto;
  @ValidateNested() @Type(() => ScenarioRatesDto) safe: ScenarioRatesDto;
}

export class WorkerRatesDto {
  /** Kopiykas per hour paid to the worker. */
  @Money() ratePerHour: number;
  /** Kopiykas per hour kept by the business. */
  @Money() businessPerHour: number;
  @Factor() markup: number;
}

export class JewelerRatesDto {
  /** Business markup on the owner's hourly pay. */
  @Factor() ownerMarkup: number;
  @ValidateNested() @Type(() => WorkerRatesDto) hired: WorkerRatesDto;
}

export class ModelingRatesDto {
  @ValidateNested() @Type(() => WorkerRatesDto) owner: WorkerRatesDto;
  @ValidateNested() @Type(() => WorkerRatesDto) hired: WorkerRatesDto;
  /** Kopiykas. */
  @Money() minPrice: number;
  @Rate() prepayment: number;
  /** Kopiykas per paid revision. */
  @Money() revisionPrice: number;
}

export class PricingDefaultsDto {
  @Money() delivery: number;
  @Money() packaging: number;
  @Money() consumables: number;
}

/** Kopiykas per stone for each metal family. */
export class FamilyRatesDto {
  @Money() gold: number;
  @Money() silver: number;
  @Money() platinum: number;
  @Money() palladium: number;
  @Money() other: number;
}

export class SettingRatesDto {
  @ValidateNested() @Type(() => FamilyRatesDto) prong: FamilyRatesDto;
  @ValidateNested() @Type(() => FamilyRatesDto) bezel: FamilyRatesDto;
  @ValidateNested() @Type(() => FamilyRatesDto) pave: FamilyRatesDto;
  @ValidateNested() @Type(() => FamilyRatesDto) channel: FamilyRatesDto;
  @ValidateNested() @Type(() => FamilyRatesDto) flush: FamilyRatesDto;
  @ValidateNested() @Type(() => FamilyRatesDto) glue: FamilyRatesDto;
  @ValidateNested() @Type(() => FamilyRatesDto) pearl_pin: FamilyRatesDto;
  @ValidateNested() @Type(() => FamilyRatesDto) hanging: FamilyRatesDto;
}

export class CutFactorsDto {
  @Factor() round: number;
  @Factor() oval: number;
  @Factor() cushion: number;
  @Factor() princess: number;
  @Factor() emerald: number;
  @Factor() baguette: number;
  @Factor() pear: number;
  @Factor() marquise: number;
  @Factor() trillion: number;
  @Factor() cabochon: number;
  @Factor() fancy: number;
}

export class SizeFactorDto {
  /** Upper bound in mm; `null` covers every larger stone. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  upToMm: number | null = null;

  @Factor() factor: number;
}

export class WaxPrintTierDto {
  @IsNumber()
  @Min(0)
  upToCm3: number;

  @IsNumber()
  @Min(0)
  usdPerCm3: number;
}

export class ServicePresetDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(60)
  code: string;

  @ApiProperty({ enum: SERVICE_CATEGORIES })
  @IsIn(SERVICE_CATEGORIES)
  category: ServiceCategory;

  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: SERVICE_UNITS })
  @IsIn(SERVICE_UNITS)
  unit: ServiceUnit;

  /** Kopiykas per unit paid to the workshop or contractor. */
  @Money() unitCost: number;
  /** Kopiykas per unit charged to the customer. */
  @Money() unitPrice: number;
}

/** Workshop-wide pricing parameters. Money in kopiykas, rates as fractions. */
export class PricingSettingsDto {
  /** Fallback UAH per USD when no market rate is stored. */
  @IsNumber()
  @Min(1)
  usdRate: number;

  @Rate() taxRate: number;
  @Rate() paymentFeeRate: number;

  /** Casting and polishing losses, share of the purchased weight. */
  @IsNumber()
  @Min(0)
  @Max(0.9)
  lossRate: number;

  /** Final prices are rounded up to this step. */
  @IsInt()
  @Min(1)
  roundingStep: number;

  /** The business profit of an item is topped up to this amount. */
  @Money() minProfit: number;

  @ApiProperty({ enum: PRICING_SCENARIOS })
  @IsIn(PRICING_SCENARIOS)
  defaultScenario: PricingScenario;

  @ValidateNested() @Type(() => ScenariosDto) scenarios: ScenariosDto;
  @Factor() stoneMarkup: number;
  @Factor() fittingsMarkup: number;
  /** Markup of the casting tariff passed to the customer. */
  @Factor() castingMarkup: number;
  /** Extra charge on setting customer-supplied stones. */
  @Factor() clientStoneRisk: number;
  @Rate() itemPrepayment: number;
  @ValidateNested() @Type(() => JewelerRatesDto) jeweler: JewelerRatesDto;
  @ValidateNested() @Type(() => ModelingRatesDto) modeling: ModelingRatesDto;
  @ValidateNested()
  @Type(() => PricingDefaultsDto)
  defaults: PricingDefaultsDto;
  @ValidateNested() @Type(() => SettingRatesDto) settingRates: SettingRatesDto;
  @ValidateNested() @Type(() => CutFactorsDto) cutFactors: CutFactorsDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SizeFactorDto)
  sizeFactors: SizeFactorDto[];

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WaxPrintTierDto)
  waxPrintTiers: WaxPrintTierDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ServicePresetDto)
  services: ServicePresetDto[];
}

/** Workshop tariffs of one metal. Money in kopiykas. */
export class MetalPricingProfileDto {
  /** Margin per gram of the finished piece. */
  @Money() marginPerGram: number;
  /** Supplier markup on the alloy. */
  @Rate() purchaseMarkup: number;
  /** Price of the non-precious part of the alloy, per gram. */
  @Money() ligaturePerGram: number;
  /** Casting tariff = pure metal price × share + fixed part, per gram. */
  @Rate() castingSpotShare: number;
  @Money() castingFixedPerGram: number;
  /** Owner jeweler pay per hour. */
  @Money() laborRateBasic: number;
  @Money() laborRateComplex: number;
  /** Minimum customer price of the jewelry work. */
  @Money() minLaborBasic: number;
  @Money() minLaborComplex: number;
  /** Keep the metal's price per gram in sync with market rates. */
  @IsBoolean()
  autoPricePerGram: boolean;
}
