import request from 'supertest';
import { DEFAULT_PRINT_SETTINGS } from '../src/modules/prints/print.settings';
import { cookieFor, createTestApp, TestContext } from './support/test.app';

interface Resin {
  id: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
  pricePerKg?: number;
}

interface Printer {
  id: string;
  code: string;
  isDefault: boolean;
  price: number;
  usdRate: number;
  costs: { price: number; wearPerHour: number; filmPerLayer: number };
}

const RESIN = {
  code: 'tough-black',
  name: 'Tough, чорна',
  kind: 'tough',
  colour: 'чорний',
  densityGPerMl: 1.15,
  pricePerKg: 90000,
};

const PRINTER = {
  code: 'mars-5',
  name: 'Elegoo Mars 5',
  buildXMm: 143,
  buildYMm: 89,
  buildZMm: 150,
  layerHeightMm: 0.05,
  secondsPerLayer: 3,
  bottomLayers: 4,
  bottomLayerSeconds: 25,
  fixedMinutes: 8,
  costCurrency: 'UAH',
  price: 1_000_000,
  lifetimeHours: 4000,
  lcdPrice: 300_000,
  lcdLifetimeHours: 2000,
  filmPrice: 20_000,
  layersPerFilm: 40000,
  electricityPerHour: 80,
  plateFillRate: 0.6,
  spacingMm: 4,
};

describe('Lab printing reference data (e2e)', () => {
  let context: TestContext;
  const admin = cookieFor('admin');
  const customer = cookieFor('customer');

  beforeAll(async () => {
    context = await createTestApp();
  });

  afterAll(async () => {
    await context.close();
  });

  const server = () => context.app.getHttpServer();
  const resins = async () =>
    (
      await request(server())
        .get('/api/resins')
        .set('Cookie', admin)
        .expect(200)
    ).body as Resin[];
  const printers = async () =>
    (
      await request(server())
        .get('/api/printers')
        .set('Cookie', admin)
        .expect(200)
    ).body as Printer[];

  it('is available to staff only', async () => {
    for (const path of [
      '/api/resins',
      '/api/printers',
      '/api/print-settings',
    ]) {
      await request(server()).get(path).expect(401);
      await request(server()).get(path).set('Cookie', customer).expect(403);
    }
  });

  it('seeds the default resin and printer', async () => {
    const [resin] = await resins();
    expect(resin).toMatchObject({ code: 'abs-like-grey', isDefault: true });

    const [printer] = await printers();
    expect(printer).toMatchObject({
      code: 'saturn-4-ultra-16k',
      isDefault: true,
      price: 56300,
    });
    expect(printer.usdRate).toBeGreaterThan(0);
    expect(printer.costs.price).toBe(Math.round(56300 * printer.usdRate));
    expect(printer.costs.wearPerHour).toBeGreaterThan(0);
  });

  it('manages resins with a single default', async () => {
    const created = await request(server())
      .post('/api/resins')
      .set('Cookie', admin)
      .send({ ...RESIN, isDefault: true })
      .expect(201);
    const resin = created.body as Resin;

    let list = await resins();
    expect(
      list.filter((item) => item.isDefault).map((item) => item.id),
    ).toEqual([resin.id]);

    await request(server())
      .post('/api/resins')
      .set('Cookie', admin)
      .send(RESIN)
      .expect(409);
    await request(server())
      .post('/api/resins')
      .set('Cookie', admin)
      .send({ ...RESIN, code: 'too-dense', densityGPerMl: 5 })
      .expect(400);

    const seeded = list.find((item) => item.code === 'abs-like-grey')!;
    await request(server())
      .patch(`/api/resins/${seeded.id}`)
      .set('Cookie', admin)
      .send({ isDefault: true })
      .expect(200);
    await request(server())
      .patch(`/api/resins/${resin.id}`)
      .set('Cookie', admin)
      .send({ isActive: false })
      .expect(200);

    list = await resins();
    expect(list.find((item) => item.id === resin.id)).toMatchObject({
      isDefault: false,
      isActive: false,
    });

    const storefront = await request(server())
      .get('/api/storefront/resins')
      .expect(200);
    const visible = storefront.body as Resin[];
    expect(visible.map((item) => item.code)).toEqual(['abs-like-grey']);
    expect(visible[0].pricePerKg).toBeUndefined();

    await request(server())
      .delete(`/api/resins/${resin.id}`)
      .set('Cookie', admin)
      .expect(204);
    await request(server())
      .delete(`/api/resins/${resin.id}`)
      .set('Cookie', admin)
      .expect(404);
  });

  it('manages printers and costs UAH prices as is', async () => {
    const created = await request(server())
      .post('/api/printers')
      .set('Cookie', admin)
      .send({ ...PRINTER, isDefault: true })
      .expect(201);
    const printer = created.body as Printer;
    expect(printer.costs).toMatchObject({
      price: 1_000_000,
      wearPerHour: 1_000_000 / 4000 + 300_000 / 2000,
      filmPerLayer: 0.5,
    });

    const list = await printers();
    expect(
      list.filter((item) => item.isDefault).map((item) => item.id),
    ).toEqual([printer.id]);

    await request(server())
      .post('/api/printers')
      .set('Cookie', admin)
      .send({ ...PRINTER, code: 'bad-fill', plateFillRate: 2 })
      .expect(400);
    await request(server())
      .patch(`/api/printers/${printer.id}`)
      .set('Cookie', admin)
      .send({ secondsPerLayer: 2.5 })
      .expect(200);
    await request(server())
      .delete(`/api/printers/${printer.id}`)
      .set('Cookie', admin)
      .expect(204);
    await request(server())
      .get(`/api/printers/${printer.id}`)
      .set('Cookie', admin)
      .expect(404);
  });

  it('stores the print pricing settings', async () => {
    const initial = await request(server())
      .get('/api/print-settings')
      .set('Cookie', admin)
      .expect(200);
    expect(initial.body).toEqual(DEFAULT_PRINT_SETTINGS);

    const changed = {
      ...DEFAULT_PRINT_SETTINGS,
      work: { ...DEFAULT_PRINT_SETTINGS.work, hourlyRate: 6000 },
    };
    const saved = await request(server())
      .put('/api/print-settings')
      .set('Cookie', admin)
      .send(changed)
      .expect(200);
    expect(saved.body).toEqual(changed);

    await request(server())
      .put('/api/print-settings')
      .set('Cookie', admin)
      .send({
        ...changed,
        price: { ...changed.price, productionDaysMin: 5, productionDaysMax: 3 },
      })
      .expect(400);
    await request(server())
      .put('/api/print-settings')
      .set('Cookie', admin)
      .send({
        ...changed,
        material: { ...changed.material, supportRate: 10 },
      })
      .expect(400);
  });
});
