import { createHash } from 'node:crypto';
import type { LiqPayConfig } from './liqpay.config';
import { LiqPayService } from './liqpay.service';

describe('LiqPayService', () => {
  const gripr = {
    publicKey: 'public',
    privateKey: 'private',
    receiptGoodId: null,
  };
  const config: LiqPayConfig = {
    merchants: { gripr, lab: null },
    sandbox: true,
    signatureAlgorithm: 'sha3-256',
    serverUrl: 'https://api.example.com/api/payments/liqpay/callback',
    resultUrl: 'https://example.com/checkout/result',
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
    const checkout = service.createCheckout('gripr', {
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
      merchants: { gripr: { ...gripr, receiptGoodId: 777 }, lab: null },
    }).createCheckout('gripr', {
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
      ).toEqual({
        merchant: 'gripr',
        callback: { order_id: 'payment-1', status: 'success' },
      });
    }
  });

  it('rejects forged callbacks', () => {
    const data = encode({ order_id: 'payment-1', status: 'success' });
    const forged = createHash('sha1')
      .update(`wrong${data}wrong`)
      .digest('base64');

    expect(service.parseCallback(data, forged)).toBeNull();
  });

  describe('with a Lab shop', () => {
    const lab = new LiqPayService({
      ...config,
      merchants: {
        gripr,
        lab: {
          publicKey: 'lab-public',
          privateKey: 'lab-private',
          receiptGoodId: 888,
        },
      },
    });

    it('signs Lab checkouts with the Lab keys and receipt good', () => {
      const checkout = lab.createCheckout('lab', {
        paymentId: 'payment-2',
        orderId: 'order-2',
        amount: 9_000,
        description: 'Оплата замовлення L-1001',
        receipt: { lines: [{ quantity: 1, unitPrice: 9_000 }], emails: [] },
      });
      const payload = decode(checkout.data);

      expect(payload.public_key).toBe('lab-public');
      expect(payload.rro_info).toEqual({
        items: [{ id: 888, amount: 1, price: 90, cost: 90 }],
      });
      expect(checkout.signature).toBe(
        createHash('sha3-256')
          .update(`lab-private${checkout.data}lab-private`)
          .digest('base64'),
      );
    });

    it('tells which shop signed a callback', () => {
      const data = encode({ order_id: 'payment-2', status: 'success' });

      expect(
        lab.parseCallback(data, lab.sign(data, 'sha1', 'lab'))?.merchant,
      ).toBe('lab');
      expect(
        lab.parseCallback(data, lab.sign(data, 'sha3-256', 'gripr'))?.merchant,
      ).toBe('gripr');
    });
  });

  it('refuses Lab checkouts and callbacks without a Lab shop', () => {
    const data = encode({ order_id: 'payment-2', status: 'success' });
    const labSignature = createHash('sha3-256')
      .update(`lab-private${data}lab-private`)
      .digest('base64');

    expect(service.isConfigured('lab')).toBe(false);
    expect(() =>
      service.createCheckout('lab', {
        paymentId: 'payment-2',
        orderId: 'order-2',
        amount: 9_000,
        description: 'Оплата замовлення L-1001',
        receipt,
      }),
    ).toThrow('LiqPay shop "lab" is not configured');
    expect(service.parseCallback(data, labSignature)).toBeNull();
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
