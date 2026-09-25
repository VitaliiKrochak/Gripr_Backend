import type { ReceiptLine } from '../../integrations/liqpay/liqpay.service';

/**
 * Fiscal receipt lines for a payment. A full payment lists the order items;
 * deposits and remainders are a single line for the paid amount. Unit prices
 * must be whole kopiykas, so a discounted line whose total does not divide by
 * its quantity is split into two lines. Falls back to a single line if the
 * items do not add up to the amount.
 */
export function receiptLines(
  amount: number,
  items: Array<{ quantity: number; lineTotal: number }> | null,
): ReceiptLine[] {
  const single: ReceiptLine[] = [{ quantity: 1, unitPrice: amount }];

  if (!items?.length) {
    return single;
  }

  const lines = items.flatMap(({ quantity, lineTotal }): ReceiptLine[] => {
    const unitPrice = Math.floor(lineTotal / quantity);
    const extra = lineTotal - unitPrice * quantity;

    if (!extra) {
      return [{ quantity, unitPrice }];
    }

    return [
      ...(quantity > 1 ? [{ quantity: quantity - 1, unitPrice }] : []),
      { quantity: 1, unitPrice: unitPrice + extra },
    ];
  });
  const sum = lines.reduce(
    (total, line) => total + line.quantity * line.unitPrice,
    0,
  );

  return sum === amount ? lines : single;
}
