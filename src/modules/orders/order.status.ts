import type {
  Order,
  OrderStatus,
} from '../../integrations/database/database.schema';
import { paymentThresholds } from './order.balance';

/**
 * Catalog orders and legacy custom orders use `pending_payment` → `paid`.
 * Staged custom orders go through the 3D model, production prepayment, and
 * final payment statuses instead.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['in_production', 'ready', 'cancelled', 'refunded'],
  awaiting_model_payment: ['modeling', 'cancelled'],
  modeling: ['model_review', 'cancelled'],
  model_review: ['modeling', 'awaiting_production_payment', 'cancelled'],
  awaiting_production_payment: ['in_production', 'cancelled'],
  in_production: ['awaiting_final_payment', 'ready', 'cancelled'],
  awaiting_final_payment: ['ready', 'cancelled'],
  ready: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['completed', 'refunded'],
  completed: [],
  cancelled: ['refunded'],
  refunded: [],
};

/** Statuses in which the customer can still cancel on their own. */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = [
  'pending_payment',
  'awaiting_model_payment',
];

export class OrderTransitionError extends Error {}

export type TransitionSubject = Pick<
  Order,
  | 'status'
  | 'trackingNumber'
  | 'total'
  | 'paidAmount'
  | 'modelPaymentAmount'
  | 'productionPaymentAmount'
>;

/** Throws `OrderTransitionError` when `order` cannot move to `to`. */
export function assertTransition(
  order: TransitionSubject,
  to: OrderStatus,
): void {
  if (!ORDER_TRANSITIONS[order.status].includes(to)) {
    throw new OrderTransitionError(
      `Order cannot move from ${order.status} to ${to}`,
    );
  }

  const thresholds = paymentThresholds(order);

  if (to === 'paid' && order.paidAmount <= 0) {
    throw new OrderTransitionError(
      'Record a payment before marking the order as paid',
    );
  }

  if (
    order.status === 'awaiting_model_payment' &&
    to === 'modeling' &&
    order.paidAmount < thresholds.model
  ) {
    throw new OrderTransitionError('The 3D model prepayment is not paid');
  }

  if (
    order.status === 'awaiting_production_payment' &&
    to === 'in_production' &&
    order.paidAmount < thresholds.production
  ) {
    throw new OrderTransitionError('The production prepayment is not paid');
  }

  if (to === 'awaiting_final_payment' && order.paidAmount >= order.total) {
    throw new OrderTransitionError('The order is already fully paid');
  }

  if (
    order.status === 'awaiting_final_payment' &&
    to === 'ready' &&
    order.paidAmount < order.total
  ) {
    throw new OrderTransitionError('The final payment is not paid');
  }

  if (to === 'shipped' && !order.trackingNumber) {
    throw new OrderTransitionError('Set the tracking number before shipping');
  }

  if (to === 'shipped' && order.paidAmount < order.total) {
    throw new OrderTransitionError('The order is not fully paid');
  }
}

/**
 * Status an order moves to automatically once a payment covers the amount
 * its current status waits for.
 */
export function statusAfterPayment(
  order: TransitionSubject,
): OrderStatus | null {
  const thresholds = paymentThresholds(order);

  switch (order.status) {
    case 'pending_payment':
      return order.paidAmount > 0 ? 'paid' : null;
    case 'awaiting_model_payment':
      return order.paidAmount >= thresholds.model ? 'modeling' : null;
    case 'awaiting_production_payment':
      return order.paidAmount >= thresholds.production ? 'in_production' : null;
    case 'awaiting_final_payment':
      return order.paidAmount >= order.total ? 'ready' : null;
    default:
      return null;
  }
}

/** Timestamp column set when an order enters a status. */
export function statusTimestamps(
  to: OrderStatus,
  now = new Date(),
): Partial<
  Pick<Order, 'paidAt' | 'shippedAt' | 'deliveredAt' | 'cancelledAt'>
> {
  switch (to) {
    case 'paid':
      return { paidAt: now };
    case 'shipped':
      return { shippedAt: now };
    case 'delivered':
      return { deliveredAt: now };
    case 'cancelled':
      return { cancelledAt: now };
    default:
      return {};
  }
}
