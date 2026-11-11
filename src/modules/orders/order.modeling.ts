import type {
  ModelDeliverable,
  Order,
  OrderModeling,
  OrderStatus,
  RevisionTerms,
} from '../../integrations/database/database.schema';

export const REVISION_KINDS = ['big', 'small'] as const;
export type RevisionKind = (typeof REVISION_KINDS)[number];

/** Stored with every order that delivers a model file. */
export const PERSONAL_USE_LICENSE =
  'Ліцензія на особисте використання. Gripr Lab передає вам файл моделі для ' +
  'особистого некомерційного використання: ви можете друкувати модель для себе. ' +
  'Заборонено продавати, поширювати або публікувати файл чи його змінені версії, ' +
  'а також продавати надруковані з нього вироби. Авторські права на модель ' +
  'належать Gripr Lab.';

export function deliversFile(deliverable: ModelDeliverable): boolean {
  return deliverable !== 'print';
}

export function deliversPrint(deliverable: ModelDeliverable): boolean {
  return deliverable !== 'file';
}

export function newOrderModeling(
  deliverable: ModelDeliverable,
  terms: RevisionTerms,
): OrderModeling {
  return {
    deliverable,
    terms,
    bigRevisions: 0,
    smallRevisions: 0,
    pendingRevision: false,
    license: deliversFile(deliverable) ? PERSONAL_USE_LICENSE : null,
  };
}

/** Statuses before the model is approved, or of a closed unpaid order. */
const NO_DOWNLOAD_STATUSES: OrderStatus[] = [
  'pending_payment',
  'awaiting_model_payment',
  'modeling',
  'model_review',
  'cancelled',
  'refunded',
];

/**
 * Why the customer cannot download the model files yet, or `null`: the
 * order must deliver the file, the model must be approved, and the order
 * fully paid.
 */
export function modelDownloadBlocker(
  order: Pick<Order, 'status' | 'paidAmount' | 'total' | 'modeling'>,
): string | null {
  if (!order.modeling || !deliversFile(order.modeling.deliverable)) {
    return 'The order does not deliver a model file';
  }

  if (NO_DOWNLOAD_STATUSES.includes(order.status)) {
    return 'The model file is available after the model is approved';
  }

  if (order.paidAmount < order.total) {
    return 'The model file is available once the order is fully paid';
  }

  return null;
}

export function freeRevisionsLeft(modeling: OrderModeling): {
  big: number;
  small: number;
} {
  return {
    big: Math.max(0, modeling.terms.freeBig - modeling.bigRevisions),
    small: Math.max(0, modeling.terms.freeSmall - modeling.smallRevisions),
  };
}

/**
 * Counts a revision the customer asked for. Beyond the free revisions of its
 * kind it costs the price from the terms.
 */
export function recordRevision(
  modeling: OrderModeling,
  kind: RevisionKind,
): { modeling: OrderModeling; charge: number } {
  const left = freeRevisionsLeft(modeling)[kind];
  const charge =
    left > 0
      ? 0
      : kind === 'big'
        ? modeling.terms.bigPrice
        : modeling.terms.smallPrice;

  return {
    modeling: {
      ...modeling,
      bigRevisions: modeling.bigRevisions + (kind === 'big' ? 1 : 0),
      smallRevisions: modeling.smallRevisions + (kind === 'small' ? 1 : 0),
      pendingRevision: false,
    },
    charge,
  };
}

export function toModelingDto(modeling: OrderModeling | null) {
  if (!modeling) return null;

  const left = freeRevisionsLeft(modeling);

  return {
    deliverable: modeling.deliverable,
    terms: modeling.terms,
    bigRevisions: modeling.bigRevisions,
    smallRevisions: modeling.smallRevisions,
    freeBigRevisionsLeft: left.big,
    freeSmallRevisionsLeft: left.small,
    pendingRevision: modeling.pendingRevision,
    license: modeling.license,
  };
}
