import { Injectable } from '@nestjs/common';
import type { Store } from '../../integrations/database/database.schema';
import { LiqPayService } from '../../integrations/liqpay/liqpay.service';
import type {
  PaymentProvider,
  ProviderCheckout,
  VerifiedCallback,
} from './payment.provider';

@Injectable()
export class LiqPayPaymentProvider implements PaymentProvider {
  readonly name = 'liqpay';

  constructor(private readonly liqPay: LiqPayService) {}

  isAvailable(merchant: Store): boolean {
    return this.liqPay.isConfigured(merchant);
  }

  startPayment(
    merchant: Store,
    params: Parameters<PaymentProvider['startPayment']>[1],
  ): ProviderCheckout {
    return this.liqPay.createCheckout(merchant, params);
  }

  verifyCallback(data: string, signature: string): VerifiedCallback | null {
    const parsed = this.liqPay.parseCallback(data, signature);

    if (!parsed) {
      return null;
    }

    const { merchant, callback } = parsed;

    return {
      merchant,
      paymentId: callback.order_id,
      outcome: this.liqPay.outcome(callback.status),
      providerStatus: callback.status,
      providerPaymentId:
        callback.payment_id !== undefined ? String(callback.payment_id) : null,
      amount:
        callback.currency === 'UAH'
          ? Math.round(Number(callback.amount) * 100)
          : null,
      raw: callback,
    };
  }
}
