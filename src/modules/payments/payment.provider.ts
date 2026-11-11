import type {
  PaymentProvider as PaymentProviderName,
  Store,
} from '../../integrations/database/database.schema';
import type {
  CheckoutReceipt,
  PaymentOutcome,
} from '../../integrations/liqpay/liqpay.service';

/** The form the browser submits to the provider's hosted checkout. */
export interface ProviderCheckout {
  checkoutUrl: string;
  data: string;
  signature: string;
}

/** A callback whose signature was verified by one of the store accounts. */
export interface VerifiedCallback {
  /** The store whose account signed the callback. */
  merchant: Store;
  paymentId: string;
  outcome: PaymentOutcome;
  providerStatus: string;
  providerPaymentId: string | null;
  /** In kopiykas; `null` when the provider sent no amount in UAH. */
  amount: number | null;
  raw: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  /** Whether the store has an account with this provider. */
  isAvailable(merchant: Store): boolean;
  startPayment(
    merchant: Store,
    params: {
      paymentId: string;
      orderId: string;
      /** In kopiykas. */
      amount: number;
      description: string;
      receipt: CheckoutReceipt;
    },
  ): ProviderCheckout;
  /** Returns `null` when no store account verifies the callback. */
  verifyCallback(data: string, signature: string): VerifiedCallback | null;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
