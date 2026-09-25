import { nextPayment } from './order.balance';
import {
  assertTransition,
  OrderTransitionError,
  statusTimestamps,
} from './order.status';

describe('assertTransition', () => {
  const order = {
    status: 'ready' as const,
    trackingNumber: '20450000000000',
    total: 1000,
    paidAmount: 1000,
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
  ] as const)('rejects %j -> %s', (overrides, to, message) => {
    expect(() => assertTransition({ ...order, ...overrides }, to)).toThrow(
      OrderTransitionError,
    );
    expect(() => assertTransition({ ...order, ...overrides }, to)).toThrow(
      message,
    );
  });

  it('stamps status timestamps', () => {
    const now = new Date('2026-01-01T00:00:00Z');

    expect(statusTimestamps('shipped', now)).toEqual({ shippedAt: now });
    expect(statusTimestamps('ready', now)).toEqual({});
  });
});

describe('nextPayment', () => {
  const order = {
    status: 'pending_payment' as const,
    total: 10_000,
    paidAmount: 0,
    depositAmount: null,
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

  it('returns null when nothing is due', () => {
    expect(nextPayment({ ...order, paidAmount: 10_000 })).toBeNull();
    expect(nextPayment({ ...order, status: 'cancelled' })).toBeNull();
  });
});
