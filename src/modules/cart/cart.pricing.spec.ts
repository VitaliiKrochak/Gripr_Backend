import { CartProduct, priceCart } from './cart.pricing';

function product(
  id: string,
  basePrice: number,
  overrides: Partial<CartProduct> = {},
): CartProduct {
  return {
    id,
    basePrice,
    productionDaysMin: 5,
    productionDaysMax: 7,
    availability: 'made_to_order',
    stockQuantity: 0,
    optionGroups: [],
    ...overrides,
  };
}

function line(id: string, productId: string, quantity = 1) {
  return { id, productId, optionValueIds: [], engravingText: null, quantity };
}

describe('priceCart', () => {
  const ring = product('ring', 10_000);
  const earrings = product('earrings', 20_000, {
    availability: 'in_stock',
    stockQuantity: 1,
    productionDaysMin: 0,
    productionDaysMax: 1,
  });
  const products = new Map([
    ['ring', ring],
    ['earrings', earrings],
  ]);

  it('computes totals with set discounts and parallel production time', () => {
    const cart = priceCart(
      [line('a', 'ring', 2), line('b', 'earrings')],
      products,
      [
        {
          collectionId: 'set',
          productIds: ['ring', 'earrings'],
          discountPercent: 10,
        },
      ],
    );

    expect(cart).toMatchObject({
      subtotal: 40_000,
      discount: 3_000,
      total: 37_000,
      productionDaysMin: 5,
      productionDaysMax: 7,
      hasUnavailableItems: false,
    });
    expect(cart.lines.map((l) => [l.lineTotal, l.fromStock])).toEqual([
      [19_000, false],
      [18_000, true],
    ]);
  });

  it('marks lines exceeding stock or missing products as unavailable', () => {
    const cart = priceCart(
      [line('a', 'earrings', 2), line('b', 'gone'), line('c', 'ring')],
      products,
      [],
    );

    expect(cart.lines.map((l) => l.unavailableReason)).toEqual([
      'Only 1 left in stock',
      'Product is no longer available',
      null,
    ]);
    expect(cart).toMatchObject({
      total: 10_000,
      hasUnavailableItems: true,
    });
  });

  it('reports configuration problems per line', () => {
    const configurable = product('configurable', 1_000, {
      optionGroups: [
        {
          id: 'size',
          name: 'Розмір',
          kind: 'size',
          isRequired: true,
          values: [
            {
              id: 'v',
              label: '16',
              priceDelta: 0,
              productionDaysDelta: 0,
              isDefault: false,
              isAvailable: true,
            },
          ],
        },
      ],
    });

    const cart = priceCart(
      [line('a', 'configurable')],
      new Map([['configurable', configurable]]),
      [],
    );

    expect(cart.lines[0].unavailableReason).toBe(
      'Select an option for "Розмір"',
    );
  });
});
