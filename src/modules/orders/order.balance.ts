import type {
  Order,
  PaymentType,
} from '../../integrations/database/database.schema';

export interface NextPayment {
  type: Extract<PaymentType, 'full' | 'deposit' | 'remainder'>;
  amount: number;
}

/**
 * The payment the customer is expected to make next: the deposit (custom
 * orders), the full amount, or the remaining balance.
 */
export function nextPayment(
  order: Pick<Order, 'status' | 'total' | 'paidAmount' | 'depositAmount'>,
): NextPayment | null {
  const due = order.total - order.paidAmount;

  if (order.status === 'cancelled' || order.status === 'refunded' || due <= 0) {
    return null;
  }

  if (order.paidAmount === 0) {
    return order.depositAmount && order.depositAmount < order.total
      ? { type: 'deposit', amount: order.depositAmount }
      : { type: 'full', amount: order.total };
  }

  return { type: 'remainder', amount: due };
}
