import { ApiProperty } from '@nestjs/swagger';
import { METAL_FAMILIES } from '../../../integrations/database/database.schema';
import type { MetalFamily } from '../../../integrations/database/database.schema';
import { MetalPricingProfileDto } from './pricing.settings.dto';

/** Catalog metal with its workshop tariffs and calculated prices. */
export class PricingMetalDto {
  id: string;
  code: string;
  name: string;
  @ApiProperty({ enum: METAL_FAMILIES })
  family: MetalFamily;
  @ApiProperty({ nullable: true })
  purity: string | null;
  isActive: boolean;
  /** Fineness in parts per thousand used by the calculator. */
  fineness: number;
  /** Customer price per gram used by the storefront, kopiykas. */
  @ApiProperty({ nullable: true })
  pricePerGram: number | null;
  profile: MetalPricingProfileDto;
  /** The profile is the family default, not saved for this metal. */
  profileIsDefault: boolean;
  /** Kopiykas per gram of the pure metal; 0 without a market rate. */
  purePricePerGram: number;
  /** Alloy purchase price, kopiykas per gram. */
  alloyPricePerGram: number;
  castingCostPerGram: number;
  castingPricePerGram: number;
  /**
   * Customer price of one extra finished gram in the default scenario;
   * applied as the price per gram when `profile.autoPricePerGram` is on.
   */
  suggestedPricePerGram: number;
}
