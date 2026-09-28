import {
  applySetDiscounts,
  combineProductionDays,
  ConfigurableProduct,
  configureProduct,
  ConfigurationError,
  priceFrom,
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

describe('weight-based pricing', () => {
  const chain: ConfigurableProduct = {
    basePrice: 200_000,
    productionDaysMin: 5,
    productionDaysMax: 7,
    weightGrams: 4,
    stones: [
      { quantity: 3, unitPrice: 10_000 },
      { quantity: 1, unitPrice: 50_000 },
    ],
    optionGroups: [
      {
        id: 'metal',
        name: 'Метал',
        kind: 'metal',
        isRequired: true,
        values: [
          {
            ...value('gold', 0, { isDefault: true }),
            metal: { pricePerGram: 300_000 },
          },
          { ...value('silver'), metal: { pricePerGram: 5_000 } },
        ],
      },
      {
        id: 'length',
        name: 'Довжина',
        kind: 'size',
        isRequired: true,
        values: [
          { ...value('45', 0, { isDefault: true }), weightDeltaGrams: 0 },
          { ...value('55', 0), weightDeltaGrams: 1 },
        ],
      },
      {
        id: 'coating',
        name: 'Покриття',
        kind: 'coating',
        isRequired: false,
        values: [value('rhodium', 40_000)],
      },
    ],
  };

  it('adds metal by weight, stones, and option surcharges', () => {
    expect(configureProduct(chain, []).breakdown).toEqual({
      manufacturing: 200_000,
      metal: 1_200_000,
      stones: 80_000,
      options: 0,
      weightGrams: 4,
    });

    const longer = configureProduct(chain, ['55', 'rhodium']);
    expect(longer.breakdown).toMatchObject({
      metal: 1_500_000,
      options: 40_000,
      weightGrams: 5,
    });
    expect(longer.unitPrice).toBe(200_000 + 1_500_000 + 80_000 + 40_000);
    expect(configureProduct(chain, ['silver']).breakdown.metal).toBe(20_000);
  });

  it('keeps products without weight priced as before', () => {
    expect(configureProduct(ring, ['size-16']).breakdown).toEqual({
      manufacturing: 1_000_000,
      metal: 0,
      stones: 0,
      options: 0,
      weightGrams: null,
    });
  });

  it('uses the default configuration as the card price', () => {
    expect(priceFrom(chain)).toBe(1_480_000);
    expect(
      priceFrom({
        ...chain,
        optionGroups: [
          { ...chain.optionGroups[0], values: [value('no-default')] },
        ],
      }),
    ).toBe(280_000);
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
