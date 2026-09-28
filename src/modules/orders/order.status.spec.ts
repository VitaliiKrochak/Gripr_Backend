import { nextPayment } from './order.balance';
import {
  assertTransition,
  OrderTransitionError,
  statusAfterPayment,
  statusTimestamps,
} from './order.status';

describe('assertTransition', () => {
  const order = {
    status: 'ready' as const,
    trackingNumber: '20450000000000',
    total: 1000,
    paidAmount: 1000,
    modelPaymentAmount: null,
    productionPaymentAmount: null,
  };

  it('allows the production flow', () => {
    expect(() => assertTransition(order, 'shipped')).not.toThrow();
    expect(() =>
      assertTransition({ ...order, status: 'paid' }, 'in_production'),
    ).not.toThrow();
  });

  it.each([
    [{ status: 'completed' }, 'cancelled', 'cannot move'],
    [{ status: 'shipped' }, 'cancelled', 'cannot move'],
    [{ status: 'pending_payment', paidAmount: 0 }, 'paid', 'Record a payment'],
    [{ trackingNumber: null }, 'shipped', 'tracking number'],
    [{ paidAmount: 500 }, 'shipped', 'not fully paid'],
    [
      {
        status: 'awaiting_model_payment',
        paidAmount: 0,
        modelPaymentAmount: 300,
      },
      'modeling',
      '3D model prepayment',
    ],
    [
      {
        status: 'awaiting_production_payment',
        paidAmount: 300,
        modelPaymentAmount: 300,
        productionPaymentAmount: 400,
      },
      'in_production',
      'production prepayment',
    ],
    [
      { status: 'awaiting_final_payment', paidAmount: 900 },
      'ready',
      'final payment',
    ],
    [{ status: 'in_production' }, 'awaiting_final_payment', 'fully paid'],
    [{ status: 'modeling' }, 'in_production', 'cannot move'],
  ] as const)('rejects %j -> %s', (overrides, to, message) => {
    expect(() => assertTransition({ ...order, ...overrides }, to)).toThrow(
      OrderTransitionError,
    );
    expect(() => assertTransition({ ...order, ...overrides }, to)).toThrow(
      message,
    );
  });

  it('allows the staged custom flow', () => {
    const staged = {
      ...order,
      total: 1000,
      modelPaymentAmount: 200,
      productionPaymentAmount: 400,
    };

    expect(() =>
      assertTransition(
        { ...staged, status: 'awaiting_model_payment', paidAmount: 200 },
        'modeling',
      ),
    ).not.toThrow();
    expect(() =>
      assertTransition({ ...staged, status: 'model_review' }, 'modeling'),
    ).not.toThrow();
    expect(() =>
      assertTransition(
        { ...staged, status: 'model_review' },
        'awaiting_production_payment',
      ),
    ).not.toThrow();
    expect(() =>
      assertTransition(
        { ...staged, status: 'in_production', paidAmount: 600 },
        'awaiting_final_payment',
      ),
    ).not.toThrow();
  });

  it('stamps status timestamps', () => {
    const now = new Date('2026-01-01T00:00:00Z');

    expect(statusTimestamps('shipped', now)).toEqual({ shippedAt: now });
    expect(statusTimestamps('ready', now)).toEqual({});
  });
});

describe('statusAfterPayment', () => {
  const staged = {
    trackingNumber: null,
    total: 1000,
    modelPaymentAmount: 200,
    productionPaymentAmount: 400,
  };

  it.each([
    ['pending_payment', 1, 'paid'],
    ['awaiting_model_payment', 100, null],
    ['awaiting_model_payment', 200, 'modeling'],
    ['awaiting_production_payment', 500, null],
    ['awaiting_production_payment', 600, 'in_production'],
    ['awaiting_final_payment', 1000, 'ready'],
    ['model_review', 1000, null],
  ] as const)('%s with %d paid -> %s', (status, paidAmount, expected) => {
    expect(statusAfterPayment({ ...staged, status, paidAmount })).toBe(
      expected,
    );
  });
});

describe('nextPayment', () => {
  const order = {
    status: 'pending_payment' as const,
    total: 10_000,
    paidAmount: 0,
    depositAmount: null,
    modelPaymentAmount: null,
    productionPaymentAmount: null,
  };

  it('asks for the full amount by default', () => {
    expect(nextPayment(order)).toEqual({ type: 'full', amount: 10_000 });
  });

  it('asks for the deposit first, then the remainder', () => {
    expect(nextPayment({ ...order, depositAmount: 3_000 })).toEqual({
      type: 'deposit',
      amount: 3_000,
    });
    expect(
      nextPayment({
        ...order,
        status: 'in_production',
        depositAmount: 3_000,
        paidAmount: 3_000,
      }),
    ).toEqual({ type: 'remainder', amount: 7_000 });
  });

  it('asks for staged prepayments of custom orders', () => {
    const staged = {
      ...order,
      modelPaymentAmount: 1_000,
      productionPaymentAmount: 4_000,
    };

    expect(
      nextPayment({ ...staged, status: 'awaiting_model_payment' }),
    ).toEqual({ type: 'model_prepayment', amount: 1_000 });
    expect(
      nextPayment({ ...staged, status: 'modeling', paidAmount: 1_000 }),
    ).toBeNull();
    expect(
      nextPayment({
        ...staged,
        status: 'awaiting_production_payment',
        paidAmount: 1_000,
      }),
    ).toEqual({ type: 'production_prepayment', amount: 4_000 });
    expect(
      nextPayment({
        ...staged,
        status: 'awaiting_final_payment',
        paidAmount: 5_000,
      }),
    ).toEqual({ type: 'remainder', amount: 5_000 });
  });

  it('returns null when nothing is due', () => {
    expect(nextPayment({ ...order, paidAmount: 10_000 })).toBeNull();
    expect(nextPayment({ ...order, status: 'cancelled' })).toBeNull();
  });
});
