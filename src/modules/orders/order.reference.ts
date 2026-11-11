import type { Store } from '../../integrations/database/database.schema';

export const ORDER_REFERENCE_PREFIXES: Record<Store, string> = {
  gripr: 'GR',
  lab: 'LAB',
};

/**
 * Customer-facing order reference, e.g. `GR-1042` or `LAB-1043`. Both stores
 * share one number sequence, so the number alone is unique.
 */
export function orderReference(store: Store, number: number): string {
  return `${ORDER_REFERENCE_PREFIXES[store]}-${number}`;
}

/** Reads `1043`, `LAB-1043`, or `lab1043`; `null` for anything else. */
export function parseOrderReference(
  value: string,
): { store: Store | null; number: number } | null {
  const match = /^(?:([a-z]+)-?)?(\d{1,9})$/i.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, prefix, digits] = match;

  if (!prefix) {
    return { store: null, number: Number(digits) };
  }

  const store = (Object.keys(ORDER_REFERENCE_PREFIXES) as Store[]).find(
    (key) => ORDER_REFERENCE_PREFIXES[key] === prefix.toUpperCase(),
  );

  return store ? { store, number: Number(digits) } : null;
}
