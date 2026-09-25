import type { PaymentStatus } from '../../integrations/database/database.schema';
import type { PaymentOutcome } from '../../integrations/liqpay/liqpay.service';

/**
 * Next stored status for a provider outcome, or `null` when the callback must
 * not change the payment (duplicates, out-of-order, or non-final statuses).
 * A failed attempt can still succeed when the customer retries on the same
 * checkout page; only a successful payment can be reversed.
 */
export function nextPaymentStatus(
  current: PaymentStatus,
  outcome: PaymentOutcome,
): PaymentStatus | null {
  switch (outcome) {
    case 'success':
      return current === 'pending' || current === 'failure' ? 'success' : null;
    case 'failure':
      return current === 'pending' ? 'failure' : null;
    case 'reversed':
      return current === 'success' ? 'reversed' : null;
    default:
      return null;
  }
}
