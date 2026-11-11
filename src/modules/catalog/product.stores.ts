import {
  JEWELRY_PRODUCT_TYPES,
  LAB_PRODUCT_TYPES,
} from '../../integrations/database/database.schema';
import type {
  JewelryProductType,
  OptionGroupKind,
  ProductType,
  Store,
} from '../../integrations/database/database.schema';

export const STORE_PRODUCT_TYPES: Record<Store, readonly ProductType[]> = {
  gripr: JEWELRY_PRODUCT_TYPES,
  lab: LAB_PRODUCT_TYPES,
};

/** Configurator group kinds each store's products may use. */
export const STORE_OPTION_KINDS: Record<Store, readonly OptionGroupKind[]> = {
  gripr: [
    'metal',
    'stone',
    'size',
    'engraving',
    'coating',
    'processing',
    'custom',
  ],
  lab: ['scale', 'resin', 'painting', 'base', 'finish', 'custom'],
};

export function storeOfType(type: ProductType): Store {
  return (LAB_PRODUCT_TYPES as readonly ProductType[]).includes(type)
    ? 'lab'
    : 'gripr';
}

export function isJewelryType(type: ProductType): type is JewelryProductType {
  return storeOfType(type) === 'gripr';
}

/** Why a product of this type cannot use the option kind, or `null`. */
export function optionKindError(
  type: ProductType,
  kind: OptionGroupKind,
): string | null {
  const store = storeOfType(type);

  return STORE_OPTION_KINDS[store].includes(kind)
    ? null
    : `"${kind}" options are not available for ${store === 'lab' ? 'Lab' : 'jewelry'} products`;
}
