import type { CustomRequestStatus } from '../../integrations/database/database.schema';

/**
 * Allowed request transitions. Admins review, send proposals (new versions
 * replace older ones), or reject; customers approve a proposal, ask for
 * changes, or withdraw the request.
 */
export const CUSTOM_REQUEST_TRANSITIONS: Record<
  CustomRequestStatus,
  readonly CustomRequestStatus[]
> = {
  new: ['in_review', 'quoted', 'rejected', 'declined'],
  in_review: ['quoted', 'rejected', 'declined'],
  quoted: [
    'in_review',
    'quoted',
    'changes_requested',
    'accepted',
    'rejected',
    'declined',
  ],
  changes_requested: ['in_review', 'quoted', 'rejected', 'declined'],
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
