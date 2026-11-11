import {
  JEWELRY_PRODUCT_TYPES,
  LAB_PRODUCT_TYPES,
  OPTION_GROUP_KINDS,
} from '../../integrations/database/database.schema';
import {
  isJewelryType,
  optionKindError,
  STORE_OPTION_KINDS,
  storeOfType,
} from './product.stores';

describe('product stores', () => {
  it('assigns every product type to exactly one store', () => {
    for (const type of JEWELRY_PRODUCT_TYPES) {
      expect(storeOfType(type)).toBe('gripr');
      expect(isJewelryType(type)).toBe(true);
    }

    for (const type of LAB_PRODUCT_TYPES) {
      expect(storeOfType(type)).toBe('lab');
      expect(isJewelryType(type)).toBe(false);
    }
  });

  it('gives every option kind to at least one store', () => {
    const used = new Set([
      ...STORE_OPTION_KINDS.gripr,
      ...STORE_OPTION_KINDS.lab,
    ]);

    expect(OPTION_GROUP_KINDS.filter((kind) => !used.has(kind))).toEqual([]);
  });

  it('keeps jewelry options off Lab products and the other way round', () => {
    expect(optionKindError('ring', 'metal')).toBeNull();
    expect(optionKindError('ring', 'custom')).toBeNull();
    expect(optionKindError('ring', 'resin')).toMatch(/jewelry/);
    expect(optionKindError('figurine', 'scale')).toBeNull();
    expect(optionKindError('figurine', 'custom')).toBeNull();
    expect(optionKindError('figurine', 'stone')).toMatch(/Lab/);
  });
});
