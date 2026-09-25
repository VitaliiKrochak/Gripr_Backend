import { createHash } from 'node:crypto';
import type { LiqPayConfig } from './liqpay.config';
import { LiqPayService } from './liqpay.service';

describe('LiqPayService', () => {
  const config: LiqPayConfig = {
    publicKey: 'public',
    privateKey: 'private',
    sandbox: true,
    signatureAlgorithm: 'sha3-256',
    serverUrl: 'https://api.example.com/api/payments/liqpay/callback',
    resultUrl: 'https://example.com/checkout/result',
    receiptGoodId: null,
  };
  const service = new LiqPayService(config);
  const receipt = {
    lines: [
      { quantity: 1, unitPrice: 100_000 },
      { quantity: 2, unitPrice: 11_725 },
    ],
    emails: ['buyer@example.com'],
  };

  function decode(data: string): Record<string, unknown> {
    return JSON.parse(Buffer.from(data, 'base64').toString()) as Record<
      string,
      unknown
    >;
  }

  function encode(payload: object): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  it('builds checkout data in UAH with a SHA3-256 signature', () => {
    const checkout = service.createCheckout({
      paymentId: 'payment-1',
      orderId: 'order-1',
      amount: 123_450,
      description: 'Оплата замовлення №1001',
      receipt,
    });
    const payload = decode(checkout.data);

    expect(checkout.checkoutUrl).toBe('https://www.liqpay.ua/api/3/checkout');
    expect(payload).toMatchObject({
      public_key: 'public',
      action: 'pay',
      amount: 1234.5,
      currency: 'UAH',
      order_id: 'payment-1',
      result_url: 'https://example.com/checkout/result?orderId=order-1',
      server_url: config.serverUrl,
      sandbox: 1,
    });
    expect(checkout.signature).toBe(
      createHash('sha3-256')
        .update(`private${checkout.data}private`)
        .digest('base64'),
    );
    expect(payload).not.toHaveProperty('rro_info');
  });

  it('requests a fiscal receipt when a receipt good is configured', () => {
    const checkout = new LiqPayService({
      ...config,
      receiptGoodId: 777,
    }).createCheckout({
      paymentId: 'payment-1',
      orderId: 'order-1',
      amount: 123_450,
      description: 'Оплата замовлення №1001',
      receipt,
    });

    expect(decode(checkout.data).rro_info).toEqual({
      items: [
        { id: 777, amount: 1, price: 1000, cost: 1000 },
        { id: 777, amount: 2, price: 117.25, cost: 234.5 },
      ],
      delivery_emails: ['buyer@example.com'],
    });
  });

  it('accepts callbacks signed with SHA3-256 or legacy SHA-1', () => {
    const data = encode({ order_id: 'payment-1', status: 'success' });

    for (const algorithm of ['sha3-256', 'sha1'] as const) {
      expect(
        service.parseCallback(data, service.sign(data, algorithm)),
      ).toMatchObject({ order_id: 'payment-1', status: 'success' });
    }
  });

  it('rejects forged callbacks', () => {
    const data = encode({ order_id: 'payment-1', status: 'success' });
    const forged = createHash('sha1')
      .update(`wrong${data}wrong`)
      .digest('base64');

    expect(service.parseCallback(data, forged)).toBeNull();
  });

  it.each([
    ['success', 'success'],
    ['wait_compensation', 'success'],
    ['sandbox', 'success'],
    ['failure', 'failure'],
    ['error', 'failure'],
    ['reversed', 'reversed'],
    ['processing', 'pending'],
  ])('maps %s to %s', (status, outcome) => {
    expect(service.outcome(status)).toBe(outcome);
  });

  it('does not treat sandbox payments as paid in production', () => {
    expect(
      new LiqPayService({ ...config, sandbox: false }).outcome('sandbox'),
    ).toBe('pending');
  });
});
