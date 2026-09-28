import type {
  Order,
  OrderStatus,
  PaymentType,
} from '../../integrations/database/database.schema';

export interface NextPayment {
  type: Extract<
    PaymentType,
    | 'full'
    | 'deposit'
    | 'model_prepayment'
    | 'production_prepayment'
    | 'remainder'
  >;
  amount: number;
}

type BalanceSubject = Pick<
  Order,
  | 'status'
  | 'total'
  | 'paidAmount'
  | 'depositAmount'
  | 'modelPaymentAmount'
  | 'productionPaymentAmount'
>;

/** Staged custom orders have a production prepayment. */
export function isStaged(
  order: Pick<Order, 'productionPaymentAmount'>,
): boolean {
  return order.productionPaymentAmount !== null;
}

/** Cumulative amounts that must be paid before modeling and production. */
export function paymentThresholds(
  order: Pick<Order, 'modelPaymentAmount' | 'productionPaymentAmount'>,
): { model: number; production: number } {
  const model = order.modelPaymentAmount ?? 0;
  return { model, production: model + (order.productionPaymentAmount ?? 0) };
}

const FINAL_PAYMENT_STATUSES: readonly OrderStatus[] = [
  'in_production',
  'awaiting_final_payment',
  'ready',
];

/**
 * The payment the customer is expected to make next: the deposit or full
 * amount (catalog and legacy custom orders), the stage prepayment (staged
 * custom orders), or the remaining balance.
 */
export function nextPayment(order: BalanceSubject): NextPayment | null {
  const due = order.total - order.paidAmount;

  if (order.status === 'cancelled' || order.status === 'refunded' || due <= 0) {
    return null;
  }

  if (isStaged(order)) {
    return nextStagedPayment(order, due);
  }

  if (order.paidAmount === 0) {
    return order.depositAmount && order.depositAmount < order.total
      ? { type: 'deposit', amount: order.depositAmount }
      : { type: 'full', amount: order.total };
  }

  return { type: 'remainder', amount: due };
}

function nextStagedPayment(
  order: BalanceSubject,
  due: number,
): NextPayment | null {
  const thresholds = paymentThresholds(order);

  if (order.status === 'awaiting_model_payment') {
    const amount = thresholds.model - order.paidAmount;
    return amount > 0 ? { type: 'model_prepayment', amount } : null;
  }

  if (order.status === 'awaiting_production_payment') {
    const amount = thresholds.production - order.paidAmount;
    return amount > 0 ? { type: 'production_prepayment', amount } : null;
  }

  return FINAL_PAYMENT_STATUSES.includes(order.status)
    ? { type: 'remainder', amount: due }
    : null;
}
