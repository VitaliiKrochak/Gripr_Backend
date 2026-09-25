import type {
  Order,
  OrderStatus,
} from '../../integrations/database/database.schema';

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['in_production', 'ready', 'cancelled', 'refunded'],
  in_production: ['ready', 'cancelled'],
  ready: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['completed', 'refunded'],
  completed: [],
  cancelled: ['refunded'],
  refunded: [],
};

/** Statuses in which the customer can still cancel on their own. */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ['pending_payment'];

export class OrderTransitionError extends Error {}

type TransitionSubject = Pick<
  Order,
  'status' | 'trackingNumber' | 'total' | 'paidAmount'
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

  if (to === 'paid' && order.paidAmount <= 0) {
    throw new OrderTransitionError(
      'Record a payment before marking the order as paid',
    );
  }

  if (to === 'shipped' && !order.trackingNumber) {
    throw new OrderTransitionError('Set the tracking number before shipping');
  }

  if (to === 'shipped' && order.paidAmount < order.total) {
    throw new OrderTransitionError('The order is not fully paid');
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
