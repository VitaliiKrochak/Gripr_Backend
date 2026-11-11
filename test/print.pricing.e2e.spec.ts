import request from 'supertest';
import { DEFAULT_PRINT_SETTINGS } from '../src/modules/prints/print.settings';
import { DELIVERY } from './support/order.fixtures';
import { cookieFor, createTestApp, TestContext } from './support/test.app';

interface OptionValue {
  id: string;
  label: string;
  resin?: Record<string, unknown> | null;
  priceDelta: number;
}

interface Product {
  id: string;
  slug: string;
  priceFrom: number;
  productionDaysMin: number;
  productionDaysMax: number;
  print: Record<string, unknown> | null;
  optionGroups: Array<{ kind: string; values: OptionValue[] }>;
}

/** The example of the Lab plan: 20 ml, 60 mm tall, 25 × 25 mm. */
const PRINT = { mode: 'auto', volumeMl: 20, sizeMm: { x: 25, y: 25, z: 60 } };

describe('Lab print pricing (e2e)', () => {
  let context: TestContext;
  const admin = cookieFor('admin');
  const customer = cookieFor('customer');
  let seededResinId: string;
  let toughResinId: string;
  let goblin: Product;

  beforeAll(async () => {
    context = await createTestApp();
    await request(server())
      .put('/api/pricing/market-rates/USD')
      .set('Cookie', admin)
      .send({ manualRate: 42 })
      .expect(200);

    const resins = await request(server())
      .get('/api/resins')
      .set('Cookie', admin)
      .expect(200);
    seededResinId = (resins.body as Array<{ id: string; code: string }>).find(
      (resin) => resin.code === 'abs-like-grey',
    )!.id;
    const tough = await request(server())
      .post('/api/resins')
      .set('Cookie', admin)
      .send({
        code: 'tough-black',
        name: 'Tough, чорна',
        kind: 'tough',
        densityGPerMl: 1.1,
        pricePerKg: 140000,
      })
      .expect(201);
    toughResinId = (tough.body as { id: string }).id;
  });

  afterAll(async () => {
    await context.close();
  });

  const server = () => context.app.getHttpServer();
  const valueId = (product: Product, kind: string, index: number) =>
    product.optionGroups.find((group) => group.kind === kind)!.values[index].id;

  it('is available to staff only', async () => {
    await request(server())
      .post('/api/print-pricing/calculate')
      .set('Cookie', customer)
      .send({ volumeMl: 20, sizeMm: PRINT.sizeMm })
      .expect(403);
  });

  it('calculates a one-off piece with its cost breakdown', async () => {
    const response = await request(server())
      .post('/api/print-pricing/calculate')
      .set('Cookie', admin)
      .send({
        volumeMl: 20,
        sizeMm: PRINT.sizeMm,
        quantity: 2,
        overrides: { plateShare: 1 },
      })
      .expect(200);

    expect(response.body).toMatchObject({
      printer: { name: 'Elegoo Saturn 4 Ultra 16K' },
      resin: { id: seededResinId },
      usdRate: 42,
      quantity: 2,
      total: 32_000,
      productionDaysMin: 2,
      productionDaysMax: 3,
      calculation: { layers: 1200, cost: 9300, unitPrice: 16_000 },
    });
  });

  it('prices Lab products per selection', async () => {
    await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send({
        slug: 'gold-ring-print',
        name: 'Ring',
        type: 'ring',
        basePrice: 1000,
        print: PRINT,
      })
      .expect(400);

    const created = await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send({
        slug: 'goblin',
        name: 'Гоблін',
        type: 'miniature',
        status: 'published',
        basePrice: 0,
        print: PRINT,
        optionGroups: [
          {
            kind: 'scale',
            isRequired: true,
            values: [{ heightMm: 60, isDefault: true }, { heightMm: 120 }],
          },
          {
            kind: 'resin',
            isRequired: true,
            values: [
              { resinId: seededResinId, isDefault: true },
              { resinId: toughResinId },
            ],
          },
          {
            kind: 'painting',
            isRequired: true,
            values: [
              {
                label: 'Без розфарбування',
                paintingMultiplier: 1,
                isDefault: true,
              },
              { label: 'Розфарбування', paintingMultiplier: 2 },
            ],
          },
          {
            kind: 'finish',
            isRequired: true,
            values: [
              { printFinish: 'supports_removed', isDefault: true },
              { printFinish: 'sanded', heightMm: 10 },
            ],
          },
        ],
      })
      .expect(201);
    goblin = created.body as Product;

    expect(goblin).toMatchObject({
      priceFrom: 9_000,
      productionDaysMin: 2,
      productionDaysMax: 3,
      print: { ...PRINT, overrides: { plateShare: null, resinMl: null } },
    });
    expect(
      goblin.optionGroups.map((group) => group.values.map((v) => v.label)),
    ).toEqual([
      ['60 мм', '120 мм'],
      ['ABS-подібна смола, сіра', 'Tough, чорна'],
      ['Без розфарбування', 'Розфарбування'],
      ['Без підтримок', 'Відшліфовано'],
    ]);
    expect(goblin.optionGroups[3].values[1]).toMatchObject({ heightMm: null });

    const page = await request(server())
      .get('/api/storefront/products/goblin?store=lab')
      .expect(200);
    expect(page.body).toMatchObject({
      pricedPerSelection: true,
      basePrice: 0,
      priceFrom: 9_000,
      defaultQuote: { unitPrice: 9_000, productionDaysMax: 3 },
    });
    const resinValue = (page.body as Product).optionGroups[1].values[0];
    expect(resinValue.resin).toMatchObject({ code: 'abs-like-grey' });
    expect(resinValue.resin).not.toHaveProperty('pricePerKg');

    const quote = (optionValueIds: string[]) =>
      request(server())
        .post('/api/storefront/products/goblin/quote?store=lab')
        .send({ optionValueIds })
        .expect(200)
        .then((response) => (response.body as { unitPrice: number }).unitPrice);

    expect(await quote([valueId(goblin, 'painting', 1)])).toBe(18_000);
    expect(await quote([valueId(goblin, 'resin', 1)])).toBeGreaterThan(9_000);
    expect(await quote([valueId(goblin, 'scale', 1)])).toBeGreaterThan(
      await quote([]),
    );
  });

  it('charges the calculated price in the cart and at checkout', async () => {
    const cart = await request(server())
      .post('/api/customers/me/cart/items')
      .set('Cookie', customer)
      .send({
        productId: goblin.id,
        optionValueIds: [valueId(goblin, 'painting', 1)],
        quantity: 2,
      })
      .expect(200);
    expect(cart.body).toMatchObject({
      store: 'lab',
      total: 36_000,
      productionDaysMin: 2,
      productionDaysMax: 3,
    });

    const order = await request(server())
      .post('/api/customers/me/orders')
      .set('Cookie', customer)
      .send({ store: 'lab', contactName: 'Олена', delivery: DELIVERY })
      .expect(201);
    expect(order.body).toMatchObject({ store: 'lab', total: 36_000 });
  });

  it('previews every combination of an unsaved product', async () => {
    const response = await request(server())
      .post('/api/print-pricing/product-preview')
      .set('Cookie', admin)
      .send({
        print: PRINT,
        optionGroups: [
          {
            kind: 'scale',
            isRequired: true,
            values: [{ heightMm: 60 }, { heightMm: 30 }],
          },
          {
            kind: 'base',
            isRequired: false,
            values: [{ label: 'Підставка 25 мм', priceDelta: 5_000 }],
          },
        ],
      })
      .expect(200);
    const preview = response.body as {
      priceFrom: number;
      truncated: boolean;
      combinations: Array<{
        choices: Array<{ label: string }>;
        calculation: { unitPrice: number } | null;
      }>;
    };

    expect(preview.truncated).toBe(false);
    expect(
      preview.combinations.map((combination) =>
        combination.choices.map((choice) => choice.label),
      ),
    ).toEqual([
      ['60 мм'],
      ['60 мм', 'Підставка 25 мм'],
      ['30 мм'],
      ['30 мм', 'Підставка 25 мм'],
    ]);
    expect(preview.combinations[0].calculation!.unitPrice).toBe(9_000);
    expect(preview.priceFrom).toBe(
      Math.min(
        ...preview.combinations
          .filter((combination) => combination.choices.length === 1)
          .map((combination) => combination.calculation!.unitPrice),
      ),
    );
  });

  it('reprices when the print settings or the USD rate change', async () => {
    const priceFrom = async () =>
      (
        (
          await request(server())
            .get(`/api/products/${goblin.id}`)
            .set('Cookie', admin)
            .expect(200)
        ).body as Product
      ).priceFrom;

    await request(server())
      .put('/api/print-settings')
      .set('Cookie', admin)
      .send({
        ...DEFAULT_PRINT_SETTINGS,
        price: { ...DEFAULT_PRINT_SETTINGS.price, markupRate: 1 },
      })
      .expect(200);
    expect(await priceFrom()).toBe(11_000);

    await request(server())
      .put('/api/pricing/market-rates/USD')
      .set('Cookie', admin)
      .send({ manualRate: 4200 })
      .expect(200);
    expect(await priceFrom()).toBeGreaterThan(11_000);
  });

  it('keeps resins used by products', async () => {
    await request(server())
      .delete(`/api/resins/${toughResinId}`)
      .set('Cookie', admin)
      .expect(409);
  });
});
