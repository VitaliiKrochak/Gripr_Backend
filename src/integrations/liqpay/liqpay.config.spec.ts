import { getLiqPayConfig } from './liqpay.config';

describe('getLiqPayConfig', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...original,
      LIQPAY_PUBLIC_KEY: 'public',
      LIQPAY_PRIVATE_KEY: 'private',
      PUBLIC_API_URL: 'https://api.example.com/',
      LIQPAY_RESULT_URL: 'https://example.com/checkout/result',
      LIQPAY_RRO_GOOD_ID: '777',
      LIQPAY_LAB_PUBLIC_KEY: '',
      LIQPAY_LAB_PRIVATE_KEY: '',
      LIQPAY_LAB_RRO_GOOD_ID: '',
    };
  });

  afterAll(() => {
    process.env = original;
  });

  it('disables the Lab shop when its keys are empty', () => {
    expect(getLiqPayConfig()).toMatchObject({
      merchants: {
        gripr: {
          publicKey: 'public',
          privateKey: 'private',
          receiptGoodId: 777,
        },
        lab: null,
      },
      serverUrl: 'https://api.example.com/api/payments/liqpay/callback',
    });
  });

  it('reads the Lab shop keys and receipt good', () => {
    Object.assign(process.env, {
      LIQPAY_LAB_PUBLIC_KEY: 'lab-public',
      LIQPAY_LAB_PRIVATE_KEY: 'lab-private',
      LIQPAY_LAB_RRO_GOOD_ID: '888',
    });

    expect(getLiqPayConfig().merchants.lab).toEqual({
      publicKey: 'lab-public',
      privateKey: 'lab-private',
      receiptGoodId: 888,
    });
  });

  it('rejects a half-configured Lab shop', () => {
    process.env.LIQPAY_LAB_PUBLIC_KEY = 'lab-public';

    expect(() => getLiqPayConfig()).toThrow(
      'Set both LIQPAY_LAB_PUBLIC_KEY and LIQPAY_LAB_PRIVATE_KEY, or neither',
    );
  });

  it('rejects a non-numeric Lab receipt good', () => {
    Object.assign(process.env, {
      LIQPAY_LAB_PUBLIC_KEY: 'lab-public',
      LIQPAY_LAB_PRIVATE_KEY: 'lab-private',
      LIQPAY_LAB_RRO_GOOD_ID: 'abc',
    });

    expect(() => getLiqPayConfig()).toThrow(
      'LIQPAY_LAB_RRO_GOOD_ID must be a numeric LiqPay good id',
    );
  });
});
