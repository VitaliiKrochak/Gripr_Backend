import {
  calculateItem,
  calculateModel,
  combineProject,
  marginalPricePerGram,
  settingPrice,
  waxPrintCost,
  type ItemInput,
  type MetalQuote,
} from './pricing.engine';
import {
  DEFAULT_PRICING_SETTINGS as settings,
  defaultMetalProfile,
} from './pricing.settings';

/** The worked example of the pricing sheet: 5 g of gold 585, 4 h of basic work. */
const gold585: MetalQuote = {
  family: 'gold',
  fineness: 585,
  purePricePerGram: 578906.7136,
  profile: defaultMetalProfile('gold', 585, 'gold-585-yellow'),
};

function item(overrides: Partial<ItemInput> = {}): ItemInput {
  return {
    metal: gold585,
    clientMetal: false,
    weightGrams: 5,
    laborType: 'basic',
    laborHours: 4,
    jeweler: 'owner',
    setter: 'owner',
    scenario: 'recommended',
    urgency: 0,
    discount: 0,
    extraProfit: 0,
    delivery: 20000,
    packaging: 2000,
    consumables: 20000,
    services: [],
    stones: [],
    fittings: [],
    overrides: {},
    ...overrides,
  };
}

const line = (result: ReturnType<typeof calculateItem>, key: string) =>
  result.lines.find((l) => l.key === key)!;

describe('calculateItem', () => {
  it('reproduces the worked example of the pricing sheet', () => {
    const result = calculateItem(item(), settings);

    expect(result.purchaseWeightGrams).toBeCloseTo(5.5556, 4);
    expect(line(result, 'metal').cost).toBeCloseTo(1975519.16, 0);
    expect(line(result, 'metalBuffer').cost).toBeCloseTo(39510.38, 0);
    expect(line(result, 'metalMargin').price).toBe(750000);
    expect(line(result, 'casting').cost).toBeCloseTo(108767.41, 0);
    expect(line(result, 'casting').price).toBeCloseTo(142916.67, 0);
    expect(line(result, 'labor').price).toBe(476000);
    expect(line(result, 'overhead').cost).toBeCloseTo(3015.35, 0);
    expect(line(result, 'risk').cost).toBeCloseTo(63713.91, 0);
    expect(result.subtotal).toBeCloseTo(3492675.47, 0);
    expect(result.finalPrice).toBe(3840000);
    expect(result.tax).toBe(230400);
    expect(result.paymentFee).toBe(115200);
    expect(result.ownerPay).toBe(280000);
    expect(result.businessProfit).toBeCloseTo(981873.79, 0);
    expect(result.marginStatus).toBe('acceptable');
    expect(result.prepayment).toBe(1920000);
    expect(result.belowMinProfit).toBe(false);
  });

  it('applies the minimum labor price and the minimum business profit', () => {
    const result = calculateItem(
      item({
        metal: {
          family: 'silver',
          fineness: 925,
          purePricePerGram: 7448.71,
          profile: defaultMetalProfile('silver', 925),
        },
        weightGrams: 2,
        laborHours: 1,
      }),
      settings,
    );

    expect(line(result, 'labor').price).toBe(50000);
    expect(line(result, 'minProfit').price).toBeGreaterThan(0);
    expect(result.businessProfit).toBeGreaterThanOrEqual(100000 - 1);
  });

  it('discounts only the margins and never the protected costs', () => {
    const full = calculateItem(item(), settings);
    const discounted = calculateItem(item({ discount: 0.1 }), settings);

    for (const key of [
      'metal',
      'metalBuffer',
      'casting',
      'delivery',
    ] as const) {
      expect(line(discounted, key).discount).toBe(0);
    }

    expect(line(discounted, 'metalMargin').discount).toBe(75000);
    expect(discounted.priceBeforeDiscount).toBe(full.finalPrice);
    expect(discounted.finalPrice).toBeLessThan(full.finalPrice);
    expect(discounted.discount).toBe(
      discounted.priceBeforeDiscount - discounted.finalPrice,
    );
  });

  it('charges no metal for customer metal but keeps the work', () => {
    const result = calculateItem(item({ clientMetal: true }), settings);

    expect(line(result, 'metal').cost).toBe(0);
    expect(line(result, 'metalMargin').price).toBe(0);
    expect(line(result, 'casting').cost).toBeGreaterThan(0);
    expect(line(result, 'labor').price).toBe(476000);
  });

  it('prices stones, setting, and fittings', () => {
    const result = calculateItem(
      item({
        stones: [
          {
            quantity: 2,
            purchasePrice: 64100,
            settingType: 'prong',
            cut: 'oval',
            sizeMm: 2.5,
            clientOwned: false,
            settingCost: 0,
          },
        ],
        fittings: [
          { quantity: 1, unitCost: 40000, unitPrice: null, clientOwned: false },
        ],
      }),
      settings,
    );

    expect(line(result, 'stones').price).toBe(160250);
    // 300 UAH × 1.1 (oval) × 1.15 (2–4 mm) per stone for gold.
    expect(line(result, 'setting').price).toBeCloseTo(75900, 0);
    expect(line(result, 'setting').discountBase).toBe(0);
    expect(result.ownerPay).toBeCloseTo(280000 + 75900, 0);
    expect(line(result, 'fittings').price).toBe(50000);
  });

  it('uses the hired jeweler rates', () => {
    const result = calculateItem(item({ jeweler: 'hired' }), settings);

    expect(result.hiredWages).toBe(100000);
    expect(line(result, 'labor').cost).toBe(100000);
    expect(line(result, 'labor').price).toBeCloseTo((100000 + 104000) * 1.7, 0);
  });

  it('respects manual overrides', () => {
    const result = calculateItem(
      item({ overrides: { alloyPricePerGram: 300000, roundingStep: 1000 } }),
      settings,
    );

    expect(line(result, 'metal').cost).toBeCloseTo((5 / 0.9) * 300000, 0);
    expect(result.finalPrice % 1000).toBe(0);
  });
});

describe('calculateModel and combineProject', () => {
  it('reproduces the 3D model and project totals of the sheet', () => {
    const model = calculateModel(
      {
        hours: 12,
        designer: 'owner',
        freeRevisions: 0,
        usedRevisions: 0,
        revisionPrice: null,
        discount: 0,
        minPrice: null,
        roundingStep: null,
      },
      settings,
    );

    expect(model.finalPrice).toBe(1130000);
    expect(model.tax).toBe(67800);
    expect(model.businessProfit).toBe(428300);
    expect(model.prepayment).toBe(565000);

    const project = combineProject(calculateItem(item(), settings), model);

    expect(project.totalPrice).toBe(4970000);
    expect(project.ownerPay).toBe(880000);
    expect(project.businessProfit).toBeCloseTo(1410173.79, 0);
    expect(project.payments.map((p) => p.amount)).toEqual([
      565000, 565000, 1920000, 1920000,
    ]);
  });

  it('charges paid revisions after the free ones and keeps them out of the prepayment', () => {
    const model = calculateModel(
      {
        hours: 2,
        designer: 'hired',
        freeRevisions: 2,
        usedRevisions: 4,
        revisionPrice: null,
        discount: 0,
        minPrice: null,
        roundingStep: null,
      },
      settings,
    );

    expect(model.paidRevisions).toBe(2);
    expect(model.revisionsPrice).toBe(20000);
    expect(model.hiredWage).toBe(50000);
    expect(model.prepayment).toBeLessThan(model.finalPrice / 2);
  });
});

describe('helpers', () => {
  it('picks the wax print tier by volume', () => {
    expect(waxPrintCost(2, settings, 40)).toBe(28 * 40 * 100);
    expect(waxPrintCost(12, settings, 40)).toBeNull();
  });

  it('prices setting by type, cut, size, and metal family', () => {
    expect(
      settingPrice(
        { settingType: 'bezel', cut: 'round', sizeMm: 9, clientOwned: false },
        'silver',
        settings,
      ),
    ).toBe(35000 * 2);
  });

  it('computes the customer price of one extra gram', () => {
    const perGram = marginalPricePerGram(gold585, settings);
    const five = calculateItem(item({ laborType: 'none' }), settings);
    const six = calculateItem(
      item({ laborType: 'none', weightGrams: 6 }),
      settings,
    );

    expect(perGram).toBeGreaterThan(500000);
    expect(
      Math.abs(six.subtotal - five.subtotal - perGram * 0.91),
    ).toBeLessThan(10);
  });
});
