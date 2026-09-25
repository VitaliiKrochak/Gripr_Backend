import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import { PaymentCheckoutDto } from '../payment.dto';
import { PaymentsService } from '../payments.service';

@ApiTags('Payments')
@ApiCookieAuth('access-token')
@Controller('customers/me/orders/:orderId/payments')
export class PrivatePaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Start a LiqPay payment for the amount currently due (full, deposit, or remainder)',
  })
  @ApiCreatedResponse({ type: PaymentCheckoutDto })
  create(
    @CurrentUser() user: User,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PaymentCheckoutDto> {
    return this.paymentsService.createCheckout(user, orderId);
  }
}
