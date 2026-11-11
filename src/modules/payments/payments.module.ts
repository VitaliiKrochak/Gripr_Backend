import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AdminPaymentsController } from './admin/payments.controller';
import { LiqPayPaymentProvider } from './liqpay.payment.provider';
import { PAYMENT_PROVIDER } from './payment.provider';
import { PaymentsService } from './payments.service';
import { PrivatePaymentsController } from './private/payments.controller';
import { PublicLiqPayCallbackController } from './public/liqpay.callback.controller';

@Module({
  imports: [OrdersModule],
  controllers: [
    PrivatePaymentsController,
    PublicLiqPayCallbackController,
    AdminPaymentsController,
  ],
  providers: [
    PaymentsService,
    { provide: PAYMENT_PROVIDER, useClass: LiqPayPaymentProvider },
  ],
})
export class PaymentsModule {}
