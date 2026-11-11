import type { PrintRequestStatus } from '../../integrations/database/database.schema';

/**
 * Allowed print request transitions. Customers build and submit requests,
 * staff review and confirm a price, and the confirmed print goes into the
 * Lab cart and an order. An expired price sends the request back to review.
 */
export const PRINT_REQUEST_TRANSITIONS: Record<
  PrintRequestStatus,
  readonly PrintRequestStatus[]
> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['in_review', 'cancelled'],
  in_review: ['confirmed', 'changes_requested', 'rejected'],
  changes_requested: ['submitted', 'cancelled'],
  confirmed: ['in_cart', 'in_review', 'cancelled'],
  in_cart: ['confirmed', 'ordered', 'in_review'],
  ordered: ['cancelled'],
  rejected: [],
  cancelled: [],
};

/** Statuses in which the customer edits the items. */
export const CUSTOMER_EDITABLE: readonly PrintRequestStatus[] = [
  'draft',
  'changes_requested',
];

/** Statuses staff work on before confirming a price. */
export const STAFF_REVIEWABLE: readonly PrintRequestStatus[] = [
  'submitted',
  'in_review',
];

/** A confirmed price is valid this long; resin and rates change. */
export const PRICE_VALID_DAYS = 14;

export function canTransitionPrintRequest(
  from: PrintRequestStatus,
  to: PrintRequestStatus,
): boolean {
  return PRINT_REQUEST_TRANSITIONS[from].includes(to);
}

export function priceValidUntil(confirmedAt: Date | null): Date | null {
  return confirmedAt
    ? new Date(confirmedAt.getTime() + PRICE_VALID_DAYS * 86_400_000)
    : null;
}

export function isPriceExpired(confirmedAt: Date | null, now: Date): boolean {
  const until = priceValidUntil(confirmedAt);
  return until !== null && until.getTime() <= now.getTime();
}
