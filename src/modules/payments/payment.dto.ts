import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PAYMENT_TYPES } from '../../integrations/database/database.schema';
import type { PaymentType } from '../../integrations/database/database.schema';

/**
 * Render a form that POSTs `data` and `signature` to `checkoutUrl`
 * (or submit it automatically) to open the LiqPay checkout.
 */
export class PaymentCheckoutDto {
  paymentId: string;
  @ApiProperty({ enum: PAYMENT_TYPES })
  type: PaymentType;
  /** In kopiykas. */
  amount: number;
  checkoutUrl: string;
  data: string;
  signature: string;
}

export class LiqPayCallbackDto {
  @IsString()
  data: string;

  @IsString()
  signature: string;
}

export class ManualPaymentDto {
  /** Received amount in kopiykas (cash, bank transfer, etc.). */
  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
