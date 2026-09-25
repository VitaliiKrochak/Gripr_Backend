import { createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { LIQPAY_CONFIG } from './liqpay.config';
import type { LiqPayConfig, LiqPaySignatureAlgorithm } from './liqpay.config';

const CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';
const API_VERSION = 7;

export interface LiqPayCheckout {
  checkoutUrl: string;
  data: string;
  signature: string;
}

export interface LiqPayCallback {
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  payment_id?: number;
  [key: string]: unknown;
}

export type PaymentOutcome = 'success' | 'failure' | 'reversed' | 'pending';

/** A fiscal receipt line; `unitPrice` is in kopiykas. */
export interface ReceiptLine {
  quantity: number;
  unitPrice: number;
}

export interface CheckoutReceipt {
  lines: ReceiptLine[];
  /** Where LiqPay emails the fiscal receipt. */
  emails: string[];
}

const SUCCESS_STATUSES = new Set(['success', 'wait_compensation']);
const FAILURE_STATUSES = new Set(['failure', 'error']);

@Injectable()
export class LiqPayService {
  constructor(@Inject(LIQPAY_CONFIG) private readonly config: LiqPayConfig) {}

  /**
   * Builds the `data`/`signature` pair the browser POSTs to `checkoutUrl`.
   * `amount` is in kopiykas. When a receipt good is configured, LiqPay issues
   * a fiscal receipt for `receipt` after a successful payment.
   */
  createCheckout(params: {
    paymentId: string;
    orderId: string;
    amount: number;
    description: string;
    receipt: CheckoutReceipt;
  }): LiqPayCheckout {
    const goodId = this.config.receiptGoodId;
    const payload = {
      version: API_VERSION,
      public_key: this.config.publicKey,
      action: 'pay',
      amount: params.amount / 100,
      currency: 'UAH',
      description: params.description,
      order_id: params.paymentId,
      language: 'uk',
      result_url: `${this.config.resultUrl}?orderId=${params.orderId}`,
      server_url: this.config.serverUrl,
      ...(this.config.sandbox ? { sandbox: 1 } : {}),
      ...(goodId !== null
        ? {
            rro_info: {
              items: params.receipt.lines.map((line) => ({
                id: goodId,
                amount: line.quantity,
                price: line.unitPrice / 100,
                cost: (line.unitPrice * line.quantity) / 100,
              })),
              ...(params.receipt.emails.length
                ? { delivery_emails: params.receipt.emails }
                : {}),
            },
          }
        : {}),
    };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');

    return {
      checkoutUrl: CHECKOUT_URL,
      data,
      signature: this.sign(data, this.config.signatureAlgorithm),
    };
  }

  /**
   * Decodes a server callback. Returns `null` when the signature is invalid.
   * Both signature algorithms are accepted while LiqPay migrates to SHA3-256.
   */
  parseCallback(data: string, signature: string): LiqPayCallback | null {
    const received = Buffer.from(signature, 'base64');
    const valid = (['sha3-256', 'sha1'] as const).some((algorithm) => {
      const expected = Buffer.from(this.sign(data, algorithm), 'base64');
      return (
        expected.length === received.length &&
        timingSafeEqual(expected, received)
      );
    });

    if (!valid) {
      return null;
    }

    return JSON.parse(
      Buffer.from(data, 'base64').toString('utf8'),
    ) as LiqPayCallback;
  }

  /** Maps a LiqPay status to the payment outcome it represents. */
  outcome(status: string): PaymentOutcome {
    if (SUCCESS_STATUSES.has(status)) return 'success';
    if (status === 'sandbox' && this.config.sandbox) return 'success';
    if (FAILURE_STATUSES.has(status)) return 'failure';
    if (status === 'reversed') return 'reversed';
    return 'pending';
  }

  sign(data: string, algorithm: LiqPaySignatureAlgorithm): string {
    return createHash(algorithm)
      .update(this.config.privateKey + data + this.config.privateKey)
      .digest('base64');
  }
}
