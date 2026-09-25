import {
  applySetDiscounts,
  combineProductionDays,
  ConfigurableProduct,
  configureProduct,
  ConfigurationError,
} from './product.configuration';

function value(
  id: string,
  priceDelta = 0,
  extra: Partial<{
    productionDaysDelta: number;
    isDefault: boolean;
    isAvailable: boolean;
  }> = {},
) {
  return {
    id,
    label: id,
    priceDelta,
    productionDaysDelta: extra.productionDaysDelta ?? 0,
    isDefault: extra.isDefault ?? false,
    isAvailable: extra.isAvailable ?? true,
  };
}

const ring: ConfigurableProduct = {
  basePrice: 1_000_000,
  productionDaysMin: 10,
  productionDaysMax: 14,
  optionGroups: [
    {
      id: 'metal',
      name: 'Метал',
      kind: 'metal',
      isRequired: true,
      values: [
        value('gold-585', 0, { isDefault: true }),
        value('platinum', 800_000, { productionDaysDelta: 5 }),
        value('silver', -600_000, { isAvailable: false }),
      ],
    },
    {
      id: 'size',
      name: 'Розмір',
      kind: 'size',
      isRequired: true,
      values: [value('size-16'), value('size-22', 50_000)],
    },
    {
      id: 'engraving',
      name: 'Гравіювання',
      kind: 'engraving',
      isRequired: false,
      values: [value('engraving-on', 30_000, { productionDaysDelta: 1 })],
    },
  ],
};

describe('configureProduct', () => {
  it('prices the selection and applies defaults for required groups', () => {
    const result = configureProduct(ring, ['size-22']);

    expect(result).toMatchObject({
      unitPrice: 1_050_000,
      productionDaysMin: 10,
      productionDaysMax: 14,
      optionValueIds: ['gold-585', 'size-22'],
      engravingText: null,
    });
    expect(result.selectedOptions.map((o) => o.groupName)).toEqual([
      'Метал',
      'Розмір',
    ]);
  });

  it('adds price and production deltas of every selected option', () => {
    const result = configureProduct(
      ring,
      ['platinum', 'size-16', 'engraving-on'],
      '  Forever  ',
    );

    expect(result).toMatchObject({
      unitPrice: 1_830_000,
      productionDaysMin: 16,
      productionDaysMax: 20,
      engravingText: 'Forever',
    });
  });

  it.each([
    [['unknown'], undefined, 'does not belong'],
    [['gold-585', 'platinum', 'size-16'], undefined, 'Only one option'],
    [['silver', 'size-16'], undefined, 'not available'],
    [['gold-585'], undefined, 'Select an option for "Розмір"'],
    [['size-16', 'engraving-on'], undefined, 'Engraving text is required'],
    [['size-16'], 'Text', 'requires selecting an engraving'],
    [['size-16', 'engraving-on'], 'x'.repeat(41), 'must not exceed'],
  ])('rejects %j with engraving %j', (ids, engraving, message) => {
    expect(() => configureProduct(ring, ids, engraving)).toThrow(
      ConfigurationError,
    );
    expect(() => configureProduct(ring, ids, engraving)).toThrow(message);
  });

  it('works for products without options', () => {
    expect(
      configureProduct(
        {
          basePrice: 500,
          productionDaysMin: 0,
          productionDaysMax: 0,
          optionGroups: [],
        },
        [],
      ).unitPrice,
    ).toBe(500);
  });
});

describe('applySetDiscounts', () => {
  const set = {
    collectionId: 'c1',
    productIds: ['ring', 'earrings'],
    discountPercent: 10,
  };

  it('discounts one unit of each product per complete set', () => {
    const discounts = applySetDiscounts(
      [
        { key: 'a', productId: 'ring', unitPrice: 1000, quantity: 2 },
        { key: 'b', productId: 'earrings', unitPrice: 2000, quantity: 1 },
      ],
      [set],
    );

    expect(Object.fromEntries(discounts)).toEqual({ a: 100, b: 200 });
  });

  it('spreads the discounted units across several lines of one product', () => {
    const discounts = applySetDiscounts(
      [
        { key: 'a', productId: 'ring', unitPrice: 1000, quantity: 1 },
        { key: 'b', productId: 'ring', unitPrice: 1500, quantity: 1 },
        { key: 'c', productId: 'earrings', unitPrice: 2000, quantity: 2 },
      ],
      [set],
    );

    expect(Object.fromEntries(discounts)).toEqual({ a: 100, b: 150, c: 400 });
  });

  it('gives no discount for incomplete sets', () => {
    expect(
      applySetDiscounts(
        [{ key: 'a', productId: 'ring', unitPrice: 1000, quantity: 3 }],
        [set],
      ).size,
    ).toBe(0);
  });
});

describe('combineProductionDays', () => {
  it('uses the longest item because pieces are made in parallel', () => {
    expect(
      combineProductionDays([
        { productionDaysMin: 3, productionDaysMax: 5 },
        { productionDaysMin: 7, productionDaysMax: 9 },
      ]),
    ).toEqual({ productionDaysMin: 7, productionDaysMax: 9 });
    expect(combineProductionDays([])).toEqual({
      productionDaysMin: 0,
      productionDaysMax: 0,
    });
  });
});
