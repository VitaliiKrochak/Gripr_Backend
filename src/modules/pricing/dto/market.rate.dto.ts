import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { RATE_CODES } from '../pricing.settings';
import type { RateCode } from '../pricing.settings';

/** UAH per troy ounce for metals, UAH per dollar for `USD`. */
export class MarketRateDto {
  @ApiProperty({ enum: RATE_CODES })
  code: RateCode;
  /** Last rate published by the National Bank of Ukraine. */
  @ApiProperty({ nullable: true })
  marketRate: number | null;
  /** Hand-entered rate that replaces the market rate. */
  @ApiProperty({ nullable: true })
  manualRate: number | null;
  /** Rate used by the calculator. */
  @ApiProperty({ nullable: true })
  effectiveRate: number | null;
  /** Kopiykas per gram of the pure metal; `null` for `USD`. */
  @ApiProperty({ nullable: true })
  purePricePerGram: number | null;
  /** `YYYY-MM-DD` the market rate is valid for. */
  @ApiProperty({ nullable: true })
  rateDate: string | null;
  @ApiProperty({ nullable: true })
  source: string | null;
  @ApiProperty({ nullable: true })
  fetchedAt: Date | null;
}

export class SetManualRateDto {
  /** `null` returns to the market rate. */
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  @Max(100_000_000)
  manualRate: number | null = null;
}
