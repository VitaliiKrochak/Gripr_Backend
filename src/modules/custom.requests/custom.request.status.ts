import type { CustomRequestStatus } from '../../integrations/database/database.schema';

/**
 * Allowed request transitions. Admins review, quote (and re-quote), or reject;
 * customers accept a quote or withdraw the request.
 */
export const CUSTOM_REQUEST_TRANSITIONS: Record<
  CustomRequestStatus,
  readonly CustomRequestStatus[]
> = {
  new: ['in_review', 'quoted', 'rejected', 'declined'],
  in_review: ['quoted', 'rejected', 'declined'],
  quoted: ['in_review', 'quoted', 'accepted', 'rejected', 'declined'],
  accepted: [],
  declined: [],
  rejected: [],
};

export function canTransitionCustomRequest(
  from: CustomRequestStatus,
  to: CustomRequestStatus,
): boolean {
  return CUSTOM_REQUEST_TRANSITIONS[from].includes(to);
}
