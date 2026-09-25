import { receiptLines } from './payment.receipt';

describe('receiptLines', () => {
  it('uses a single line for deposits and remainders', () => {
    expect(receiptLines(750_000, null)).toEqual([
      { quantity: 1, unitPrice: 750_000 },
    ]);
  });

  it('lists order items for a full payment', () => {
    expect(
      receiptLines(1_500_000, [
        { quantity: 1, lineTotal: 1_000_000 },
        { quantity: 2, lineTotal: 500_000 },
      ]),
    ).toEqual([
      { quantity: 1, unitPrice: 1_000_000 },
      { quantity: 2, unitPrice: 250_000 },
    ]);
  });

  it('splits a discounted line that does not divide evenly', () => {
    expect(receiptLines(1_000, [{ quantity: 3, lineTotal: 1_000 }])).toEqual([
      { quantity: 2, unitPrice: 333 },
      { quantity: 1, unitPrice: 334 },
    ]);
  });

  it('falls back to one line when items do not match the amount', () => {
    expect(receiptLines(900, [{ quantity: 1, lineTotal: 1_000 }])).toEqual([
      { quantity: 1, unitPrice: 900 },
    ]);
  });
});
