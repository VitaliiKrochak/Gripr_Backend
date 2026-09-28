import type { ProductType } from '../../integrations/database/database.schema';

/**
 * How a product type is sized: `ring` uses Ukrainian ring sizes (15, 15.5…),
 * `length` is chain or bracelet length in cm, `none` has no size selection.
 */
export const SIZE_SYSTEMS = ['ring', 'length', 'none'] as const;
export type SizeSystem = (typeof SIZE_SYSTEMS)[number];

export const PRODUCT_TYPE_SIZE_SYSTEMS: Record<ProductType, SizeSystem> = {
  ring: 'ring',
  earrings: 'none',
  pendant: 'none',
  necklace: 'length',
  chain: 'length',
  bracelet: 'length',
  brooch: 'none',
  cufflinks: 'none',
  other: 'none',
};

export function sizeSystemOf(type: ProductType): SizeSystem {
  return PRODUCT_TYPE_SIZE_SYSTEMS[type];
}

/** Human-readable size, e.g. `17.5` for rings and `45 см` for lengths. */
export function formatSize(type: ProductType, size: number): string {
  return sizeSystemOf(type) === 'length' ? `${size} см` : String(size);
}
