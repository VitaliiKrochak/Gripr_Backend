import {
  canTransitionPrintRequest,
  isPriceExpired,
  priceValidUntil,
} from './print.request.status';

describe('print request status', () => {
  it('follows the request flow', () => {
    expect(canTransitionPrintRequest('draft', 'submitted')).toBe(true);
    expect(canTransitionPrintRequest('submitted', 'in_review')).toBe(true);
    expect(canTransitionPrintRequest('in_review', 'confirmed')).toBe(true);
    expect(canTransitionPrintRequest('confirmed', 'in_cart')).toBe(true);
    expect(canTransitionPrintRequest('in_cart', 'ordered')).toBe(true);
    expect(canTransitionPrintRequest('ordered', 'cancelled')).toBe(true);
  });

  it('rejects skipped and final transitions', () => {
    expect(canTransitionPrintRequest('draft', 'confirmed')).toBe(false);
    expect(canTransitionPrintRequest('in_review', 'cancelled')).toBe(false);
    expect(canTransitionPrintRequest('in_cart', 'cancelled')).toBe(false);
    expect(canTransitionPrintRequest('rejected', 'submitted')).toBe(false);
    expect(canTransitionPrintRequest('cancelled', 'draft')).toBe(false);
  });

  it('keeps a confirmed price for 14 days', () => {
    const confirmedAt = new Date('2026-11-01T10:00:00Z');

    expect(priceValidUntil(confirmedAt)).toEqual(
      new Date('2026-11-15T10:00:00Z'),
    );
    expect(isPriceExpired(confirmedAt, new Date('2026-11-15T09:59:59Z'))).toBe(
      false,
    );
    expect(isPriceExpired(confirmedAt, new Date('2026-11-15T10:00:00Z'))).toBe(
      true,
    );
    expect(isPriceExpired(null, new Date())).toBe(false);
  });
});
