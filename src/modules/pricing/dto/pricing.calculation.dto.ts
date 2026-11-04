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
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { METAL_FAMILIES } from '../../../integrations/database/database.schema';
import type { MetalFamily } from '../../../integrations/database/database.schema';
import {
  ProductOptionGroupInputDto,
  ProductStoneInputDto,
} from '../../catalog/dto/product.dto';
import { ITEM_LINE_KEYS, MARGIN_STATUSES } from '../pricing.engine';
import type { ItemLineKey, MarginStatus } from '../pricing.engine';
import {
  LABOR_TYPES,
  PRICING_SCENARIOS,
  SETTING_TYPES,
  STONE_CUTS,
  WORKERS,
} from '../pricing.settings';
import type {
  LaborType,
  PricingScenario,
  SettingType,
  StoneCut,
  Worker,
} from '../pricing.settings';
import { PLAN_WARNINGS } from '../product.price.plan';
import type { PlanWarning } from '../product.price.plan';
import {
  PricingFittingInputDto,
  PricingOverridesDto,
  PricingServiceInputDto,
  ProductPricingDto,
} from './product.pricing.dto';
import { ScenarioRatesDto } from './pricing.settings.dto';

export class CalculatorStoneDto {
  @IsNumber()
  @Min(0)
  quantity: number;

  /** Purchase price per stone, kopiykas. */
  @IsInt()
  @Min(0)
  purchasePrice: number;

  @ApiProperty({ enum: SETTING_TYPES, nullable: true, required: false })
  @IsOptional()
  @IsIn(SETTING_TYPES)
  settingType: SettingType | null = null;

  @ApiProperty({ enum: STONE_CUTS, nullable: true, required: false })
  @IsOptional()
  @IsIn(STONE_CUTS)
  cut: StoneCut | null = null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sizeMm: number | null = null;

  /** Customer-supplied stone: no stone sale, the setting stays paid. */
  @IsOptional()
  @IsBoolean()
  clientOwned = false;

  /** Paid per stone to a hired or outside setter, kopiykas. */
  @IsOptional()
  @IsInt()
  @Min(0)
  settingCost = 0;
}

export class CalculatorFittingDto extends PricingFittingInputDto {
  @IsOptional()
  @IsBoolean()
  clientOwned = false;
}

export class CalculatorModelDto {
  @IsNumber()
  @Min(0)
  @Max(1000)
  hours: number;

  @ApiProperty({ enum: WORKERS })
  @IsIn(WORKERS)
  designer: Worker;

  @IsInt()
  @Min(0)
  freeRevisions: number;

  @IsInt()
  @Min(0)
  usedRevisions: number;

  /** Kopiykas; `null` uses the settings. */
  @IsOptional()
  @IsInt()
  @Min(0)
  revisionPrice: number | null = null;

  @IsNumber()
  @Min(0)
  @Max(1)
  discount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minPrice: number | null = null;

  @IsOptional()
  @IsInt()
  @Min(1)
  roundingStep: number | null = null;
}

/** Standalone price calculation of one item and an optional 3D model. */
export class CalculatePriceDto {
  @IsOptional()
  @IsUUID()
  metalId: string | null = null;

  /** The customer supplies the metal: no purchase and no metal margin. */
  @IsOptional()
  @IsBoolean()
  clientMetal = false;

  /** Approved finished weight, grams. */
  @IsNumber()
  @Min(0)
  @Max(10_000)
  weightGrams: number;

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

  @ApiProperty({ enum: WORKERS })
  @IsIn(WORKERS)
  setter: Worker;

  @ApiProperty({ enum: PRICING_SCENARIOS, nullable: true, required: false })
  @IsOptional()
  @IsIn(PRICING_SCENARIOS)
  scenario: PricingScenario | null = null;

  @IsNumber()
  @Min(0)
  @Max(5)
  urgency: number;

  /** Discount on the margins, fraction. */
  @IsNumber()
  @Min(0)
  @Max(1)
  discount: number;

  @IsInt()
  @Min(0)
  extraProfit: number;

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
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CalculatorStoneDto)
  stones: CalculatorStoneDto[];

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CalculatorFittingDto)
  fittings: CalculatorFittingDto[];

  @ValidateNested()
  @Type(() => PricingOverridesDto)
  overrides: PricingOverridesDto;

  /** 3D model stage; `null` or omitted when the model already exists. */
  @ApiProperty({ type: CalculatorModelDto, nullable: true, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => CalculatorModelDto)
  model: CalculatorModelDto | null = null;
}

export class PriceLineDto {
  @ApiProperty({ enum: ITEM_LINE_KEYS })
  key: ItemLineKey;
  /** Protected cost that a discount never reduces. */
  cost: number;
  price: number;
  /** Part of the price a discount may reduce. */
  discountBase: number;
  discount: number;
  final: number;
}

export class ItemParametersDto {
  alloyPricePerGram: number;
  marginPerGram: number;
  lossRate: number;
  rates: ScenarioRatesDto;
  roundingStep: number;
  minProfit: number;
  castingCostPerGram: number;
  castingPricePerGram: number;
  laborRatePerHour: number;
}

/** Money in kopiykas (may be fractional before the final rounding). */
export class ItemResultDto {
  @ApiProperty({ type: [PriceLineDto] })
  lines: PriceLineDto[];
  parameters: ItemParametersDto;
  purchaseWeightGrams: number;
  lossGrams: number;
  costTotal: number;
  subtotal: number;
  priceBeforeDiscount: number;
  discount: number;
  finalPrice: number;
  tax: number;
  paymentFee: number;
  ownerPay: number;
  hiredWages: number;
  businessProfit: number;
  margin: number;
  @ApiProperty({ enum: MARGIN_STATUSES })
  marginStatus: MarginStatus;
  belowMinProfit: boolean;
  prepayment: number;
  remainder: number;
}

export class ModelResultDto {
  designerPay: number;
  ownerPay: number;
  hiredWage: number;
  businessFixed: number;
  businessMarkup: number;
  minimumTopUp: number;
  paidRevisions: number;
  revisionsPrice: number;
  discountBase: number;
  priceBeforeDiscount: number;
  discount: number;
  finalPrice: number;
  tax: number;
  paymentFee: number;
  businessProfit: number;
  margin: number;
  @ApiProperty({ enum: MARGIN_STATUSES })
  marginStatus: MarginStatus;
  prepayment: number;
  remainder: number;
}

export const PAYMENT_KEYS = [
  'modelPrepayment',
  'modelRemainder',
  'itemPrepayment',
  'itemRemainder',
] as const;

export class ProjectPaymentDto {
  @ApiProperty({ enum: PAYMENT_KEYS })
  key: (typeof PAYMENT_KEYS)[number];
  amount: number;
}

export class ProjectResultDto {
  totalPrice: number;
  discount: number;
  tax: number;
  paymentFee: number;
  netRevenue: number;
  hiredWages: number;
  ownerPay: number;
  businessProfit: number;
  ownersIncome: number;
  margin: number;
  @ApiProperty({ enum: MARGIN_STATUSES })
  marginStatus: MarginStatus;
  @ApiProperty({ type: [ProjectPaymentDto] })
  payments: ProjectPaymentDto[];
}

export class MetalQuoteDto {
  id: string;
  name: string;
  @ApiProperty({ enum: METAL_FAMILIES })
  family: MetalFamily;
  fineness: number;
  /** Market price of the pure metal, kopiykas per gram; 0 without a rate. */
  purePricePerGram: number;
}

export class PriceCalculationDto {
  @ApiProperty({ type: MetalQuoteDto, nullable: true })
  metal: MetalQuoteDto | null;
  /** UAH per USD used for wax print tiers. */
  usdRate: number;
  item: ItemResultDto;
  @ApiProperty({ type: ModelResultDto, nullable: true })
  model: ModelResultDto | null;
  project: ProjectResultDto;
}

/** Unsaved product editor state to price. */
export class ProductPricePreviewRequestDto {
  @ValidateNested()
  @Type(() => ProductPricingDto)
  pricing: ProductPricingDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightGrams: number | null = null;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProductStoneInputDto)
  stones: ProductStoneInputDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProductOptionGroupInputDto)
  optionGroups: ProductOptionGroupInputDto[];
}

export class ProductPriceVariantDto {
  @ApiProperty({ nullable: true })
  metalId: string | null;
  @ApiProperty({ nullable: true })
  metalName: string | null;
  /** Index of the value in the metal option group, `null` without one. */
  @ApiProperty({ nullable: true })
  valueIndex: number | null;
  isDefault: boolean;
  weightGrams: number;
  /** Calculated price without hand-priced stones and option surcharges. */
  totalPrice: number;
  /** Part of the price charged through the metal price per gram. */
  metalPrice: number;
  /** Surcharge to store on the metal option value. */
  priceDelta: number;
  result: ItemResultDto;
}

export class ProductPricePreviewDto {
  /** Manufacturing price to store on the product. */
  basePrice: number;
  /** Unit price per stone, in the order of the request stones. */
  @ApiProperty({ type: [Number] })
  stoneUnitPrices: number[];
  @ApiProperty({ type: [ProductPriceVariantDto] })
  variants: ProductPriceVariantDto[];
  @ApiProperty({ enum: PLAN_WARNINGS, isArray: true })
  warnings: PlanWarning[];
}
