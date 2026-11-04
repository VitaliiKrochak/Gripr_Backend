import request from 'supertest';
import { NbuService } from '../src/integrations/nbu/nbu.service';
import { cookieFor, createTestApp, TestContext } from './support/test.app';

const TROY_OUNCE_GRAMS = 31.1034768;
/** Gold rate of the pricing sheet example, UAH per troy ounce. */
const SHEET_XAU = (578906.7136 / 100) * TROY_OUNCE_GRAMS;

interface PricingMetal {
  id: string;
  code: string;
  pricePerGram: number | null;
  profile: Record<string, unknown>;
  profileIsDefault: boolean;
  suggestedPricePerGram: number;
}

const productPricing = {
  mode: 'auto',
  laborType: 'basic',
  laborHours: 4,
  jeweler: 'owner',
  setter: 'owner',
  urgency: 0,
  extraProfit: 0,
  services: [],
  fittings: [],
  overrides: {},
};

describe('Pricing calculator (e2e)', () => {
  let context: TestContext;
  const admin = cookieFor('admin');
  const customer = cookieFor('customer');
  const nbu = {
    exchangeRates: jest.fn(() =>
      Promise.resolve([
        { code: 'USD', rate: 41.5, date: '2026-11-04' },
        { code: 'XAU', rate: 170_000, date: '2026-11-04' },
        { code: 'XAG', rate: 2_000, date: '2026-11-04' },
      ]),
    ),
  };

  beforeAll(async () => {
    context = await createTestApp([[NbuService, nbu]]);
  });

  afterAll(async () => {
    await context.close();
  });

  const server = () => context.app.getHttpServer();
  const metals = async () =>
    (
      await request(server())
        .get('/api/pricing/metals')
        .set('Cookie', admin)
        .expect(200)
    ).body as PricingMetal[];

  it('is available to staff only', async () => {
    await request(server()).get('/api/pricing/settings').expect(401);
    await request(server())
      .get('/api/pricing/settings')
      .set('Cookie', customer)
      .expect(403);
    await request(server())
      .post('/api/pricing/calculate')
      .set('Cookie', customer)
      .send({})
      .expect(403);
  });

  it('stores settings over the sheet defaults', async () => {
    const current = await request(server())
      .get('/api/pricing/settings')
      .set('Cookie', admin)
      .expect(200);
    expect(current.body).toMatchObject({
      taxRate: 0.06,
      paymentFeeRate: 0.03,
      roundingStep: 10_000,
      defaultScenario: 'recommended',
    });

    await request(server())
      .put('/api/pricing/settings')
      .set('Cookie', admin)
      .send({ ...current.body, taxRate: 2 })
      .expect(400);
    const saved = await request(server())
      .put('/api/pricing/settings')
      .set('Cookie', admin)
      .send({ ...current.body, minProfit: 120_000 })
      .expect(200);
    expect(saved.body.minProfit).toBe(120_000);

    await request(server())
      .put('/api/pricing/settings')
      .set('Cookie', admin)
      .send(current.body)
      .expect(200);
  });

  it('refreshes NBU rates and lets staff override them', async () => {
    const refreshed = await request(server())
      .post('/api/pricing/market-rates/refresh')
      .set('Cookie', admin)
      .expect(200);
    expect(refreshed.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'XAU',
          marketRate: 170_000,
          effectiveRate: 170_000,
          source: 'nbu',
          rateDate: '2026-11-04',
        }),
        expect.objectContaining({ code: 'XPT', effectiveRate: null }),
      ]),
    );

    await request(server())
      .put('/api/pricing/market-rates/EUR')
      .set('Cookie', admin)
      .send({ manualRate: 1 })
      .expect(400);
    const manual = await request(server())
      .put('/api/pricing/market-rates/XAU')
      .set('Cookie', admin)
      .send({ manualRate: SHEET_XAU })
      .expect(200);
    const gold = manual.body.find(
      (rate: { code: string }) => rate.code === 'XAU',
    );
    expect(gold).toMatchObject({ marketRate: 170_000, manualRate: SHEET_XAU });
    expect(gold.purePricePerGram).toBeCloseTo(578906.7136, 3);
  });

  it('reproduces the pricing sheet example', async () => {
    const gold = (await metals()).find((m) => m.code === 'gold-585-yellow')!;
    const result = await request(server())
      .post('/api/pricing/calculate')
      .set('Cookie', admin)
      .send({
        metalId: gold.id,
        weightGrams: 5,
        laborType: 'basic',
        laborHours: 4,
        jeweler: 'owner',
        setter: 'owner',
        urgency: 0,
        discount: 0,
        extraProfit: 0,
        services: [],
        stones: [],
        fittings: [],
        overrides: {},
        model: {
          hours: 12,
          designer: 'owner',
          freeRevisions: 2,
          usedRevisions: 0,
          discount: 0,
        },
      })
      .expect(200);

    expect(result.body.item.finalPrice).toBe(3_840_000);
    expect(result.body.model.finalPrice).toBe(1_130_000);
    expect(result.body.project.totalPrice).toBe(4_970_000);
    expect(
      result.body.project.payments.map((p: { amount: number }) => p.amount),
    ).toEqual([565_000, 565_000, 1_920_000, 1_920_000]);
  });

  it('syncs the metal price per gram when enabled', async () => {
    const gold = (await metals()).find((m) => m.code === 'gold-585-yellow')!;
    expect(gold.profileIsDefault).toBe(true);
    expect(gold.suggestedPricePerGram).toBeGreaterThan(0);

    const updated = await request(server())
      .put(`/api/pricing/metals/${gold.id}/profile`)
      .set('Cookie', admin)
      .send({ ...gold.profile, autoPricePerGram: true })
      .expect(200);
    expect(updated.body).toMatchObject({
      profileIsDefault: false,
      pricePerGram: gold.suggestedPricePerGram,
    });

    const reset = await request(server())
      .delete(`/api/pricing/metals/${gold.id}/profile`)
      .set('Cookie', admin)
      .expect(200);
    expect(reset.body.profileIsDefault).toBe(true);
  });

  it('applies automatic prices to products on save', async () => {
    const all = await metals();
    const gold = all.find((m) => m.code === 'gold-585-yellow')!;
    const silver = all.find((m) => m.code === 'silver-925')!;
    const optionGroups = [
      {
        kind: 'metal',
        isRequired: true,
        values: [{ metalId: gold.id, isDefault: true }, { metalId: silver.id }],
      },
    ];

    const preview = await request(server())
      .post('/api/pricing/product-preview')
      .set('Cookie', admin)
      .send({
        pricing: productPricing,
        weightGrams: 5,
        stones: [],
        optionGroups,
      })
      .expect(200);
    expect(preview.body.variants[0]).toMatchObject({
      isDefault: true,
      totalPrice: 3_840_000,
    });
    expect(preview.body.warnings).toEqual([]);

    const created = await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send({
        slug: 'auto-ring',
        name: 'Каблучка з автоціною',
        type: 'ring',
        status: 'published',
        basePrice: 0,
        weightGrams: 5,
        pricing: productPricing,
        optionGroups,
      })
      .expect(201);
    expect(created.body).toMatchObject({
      basePrice: preview.body.basePrice,
      priceFrom: 3_840_000,
      pricing: { mode: 'auto', laborHours: 4 },
    });

    const silverValue = created.body.optionGroups[0].values[1];
    const silverQuote = await request(server())
      .post('/api/storefront/products/auto-ring/quote')
      .send({ optionValueIds: [silverValue.id] })
      .expect(200);
    expect(silverQuote.body.unitPrice).toBe(
      preview.body.variants[1].totalPrice,
    );

    const manual = await request(server())
      .patch(`/api/products/${created.body.id}`)
      .set('Cookie', admin)
      .send({
        basePrice: 100_000,
        pricing: { ...productPricing, mode: 'manual' },
      })
      .expect(200);
    expect(manual.body.basePrice).toBe(100_000);
  });

  it('keeps workshop tariffs out of storefront responses', async () => {
    const responses = await Promise.all([
      request(server()).get('/api/storefront/reference').expect(200),
      request(server()).get('/api/storefront/products/auto-ring').expect(200),
      request(server()).get('/api/storefront/products?q=автоціною').expect(200),
    ]);

    for (const response of responses) {
      const body = JSON.stringify(response.body);
      expect(body).not.toContain('pricingProfile');
      expect(body).not.toContain('purchasePrice');
      expect(body).not.toContain('laborHours');
    }
  });
});
