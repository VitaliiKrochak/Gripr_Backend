import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { CatalogFixture, createCatalog } from './support/catalog.fixtures';
import { cookieFor, createTestApp, TestContext } from './support/test.app';

interface Reference {
  id: string;
  code: string;
  name: string;
  kind?: string;
}

describe('Product pricing, drafts, and collections (e2e)', () => {
  let context: TestContext;
  let catalog: CatalogFixture;
  const admin = cookieFor('admin');
  const customer = cookieFor('customer');

  beforeAll(async () => {
    context = await createTestApp();
    catalog = await createCatalog(context.app.getHttpServer());
  });

  afterAll(async () => {
    await context.close();
  });

  const server = () => context.app.getHttpServer();
  const list = async (url: string) =>
    (await request(server()).get(url).set('Cookie', admin).expect(200))
      .body as Reference[];

  it('hides drafts from the storefront and lets staff preview them', async () => {
    const draftUrl = `/api/storefront/products/${catalog.draft.slug}`;
    await request(server()).get(draftUrl).expect(404);
    await request(server())
      .post(`${draftUrl}/quote`)
      .send({ optionValueIds: [] })
      .expect(404);
    await request(server()).get(`${draftUrl}/recommendations`).expect(404);

    const search = await request(server())
      .get('/api/storefront/products?q=Чернетка')
      .expect(200);
    expect(search.body.total).toBe(0);
    await request(server())
      .put(`/api/customers/me/favorites/${catalog.draft.id}`)
      .set('Cookie', customer)
      .expect(404);
    await request(server())
      .post('/api/customers/me/cart/items')
      .set('Cookie', customer)
      .send({ productId: catalog.draft.id })
      .expect(404);

    const previewUrl = `/api/products/${catalog.draft.id}/preview`;
    await request(server()).get(previewUrl).set('Cookie', customer).expect(403);
    const preview = await request(server())
      .get(previewUrl)
      .set('Cookie', admin)
      .expect(200);
    expect(preview.body).toMatchObject({
      slug: 'secret-ring',
      priceFrom: 100_000,
    });
    const quote = await request(server())
      .post(`${previewUrl}/quote`)
      .set('Cookie', admin)
      .send({ optionValueIds: [] })
      .expect(200);
    expect(quote.body.unitPrice).toBe(100_000);
  });

  it('saves a whole product with weight-based metal pricing and stones', async () => {
    const [metals, gemstones, finishing] = await Promise.all([
      list('/api/metals'),
      list('/api/gemstones'),
      list('/api/finishing-options'),
    ]);
    const silver = metals.find((metal) => metal.code === 'silver-925')!;
    const gold = metals.find((metal) => metal.code === 'gold-585-yellow')!;
    const rhodium = finishing.find((item) => item.code === 'rhodium')!;
    const laser = finishing.find((item) => item.code === 'laser-engraving')!;

    await request(server())
      .patch(`/api/metals/${silver.id}`)
      .set('Cookie', admin)
      .send({ pricePerGram: 5_000 })
      .expect(200);
    await request(server())
      .patch(`/api/metals/${gold.id}`)
      .set('Cookie', admin)
      .send({ pricePerGram: 300_000 })
      .expect(200);

    const metalGroupId = randomUUID();
    const silverValueId = randomUUID();
    const body = {
      slug: 'nova-chain',
      name: 'Ланцюжок Nova',
      type: 'chain',
      status: 'published',
      basePrice: 150_000,
      productionDaysMin: 5,
      productionDaysMax: 7,
      weightGrams: 4,
      stones: [{ gemstoneId: gemstones[0].id, quantity: 3, unitPrice: 10_000 }],
      optionGroups: [
        {
          id: metalGroupId,
          kind: 'metal',
          isRequired: true,
          values: [
            { id: silverValueId, metalId: silver.id, isDefault: true },
            { metalId: gold.id },
          ],
        },
        {
          kind: 'size',
          isRequired: true,
          values: [
            { sizeValue: 45, isDefault: true },
            { sizeValue: 55, weightDeltaGrams: 1 },
          ],
        },
        {
          kind: 'coating',
          values: [{ finishingId: rhodium.id, priceDelta: 40_000 }],
        },
      ],
    };

    await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send({
        ...body,
        slug: 'bad-chain',
        optionGroups: [
          {
            kind: 'coating',
            values: [{ finishingId: laser.id }],
          },
        ],
      })
      .expect(400);

    const created = await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send(body)
      .expect(201);
    expect(created.body).toMatchObject({
      priceFrom: 150_000 + 20_000 + 30_000,
      stones: [{ quantity: 3, gemstone: { id: gemstones[0].id } }],
      optionGroups: [
        {
          id: metalGroupId,
          name: 'Метал',
          values: [
            { id: silverValueId, label: silver.name, isDefault: true },
            { label: gold.name },
          ],
        },
        {
          name: 'Довжина',
          values: [{ label: '45 см' }, { label: '55 см' }],
        },
        { name: 'Покриття', values: [{ label: rhodium.name }] },
      ],
    });

    const quote = await request(server())
      .post('/api/storefront/products/nova-chain/quote')
      .send({
        optionValueIds: [
          created.body.optionGroups[0].values[1].id,
          created.body.optionGroups[1].values[1].id,
          created.body.optionGroups[2].values[0].id,
        ],
      })
      .expect(200);
    expect(quote.body.breakdown).toEqual({
      manufacturing: 150_000,
      metal: 1_500_000,
      stones: 30_000,
      options: 40_000,
      weightGrams: 5,
    });

    const page = await request(server())
      .get('/api/storefront/products/nova-chain')
      .expect(200);
    expect(page.body.characteristics).toMatchObject({
      weightGrams: 4,
      stoneCount: 3,
      coatings: [rhodium.name],
    });

    const reordered = await request(server())
      .patch(`/api/products/${created.body.id}`)
      .set('Cookie', admin)
      .send({
        optionGroups: [
          {
            id: metalGroupId,
            kind: 'metal',
            isRequired: true,
            values: [
              { metalId: gold.id, isDefault: true },
              { id: silverValueId, metalId: silver.id, isDefault: true },
            ],
          },
        ],
        stones: [],
      })
      .expect(200);
    expect(reordered.body.stones).toEqual([]);
    expect(reordered.body.optionGroups).toHaveLength(1);
    expect(
      reordered.body.optionGroups[0].values.map(
        (value: { label: string; isDefault: boolean }) => [
          value.label,
          value.isDefault,
        ],
      ),
    ).toEqual([
      [gold.name, true],
      [silver.name, false],
    ]);
    expect(reordered.body.priceFrom).toBe(150_000 + 1_200_000);

    await request(server())
      .patch(`/api/metals/${gold.id}`)
      .set('Cookie', admin)
      .send({ pricePerGram: 250_000 })
      .expect(200);
    const card = await request(server())
      .get('/api/storefront/products?q=Nova')
      .expect(200);
    expect(card.body.items[0].priceFrom).toBe(150_000 + 1_000_000);
  });

  it('manages finishing options as reference data', async () => {
    await request(server())
      .post('/api/finishing-options')
      .set('Cookie', customer)
      .send({})
      .expect(403);
    const created = await request(server())
      .post('/api/finishing-options')
      .set('Cookie', admin)
      .send({
        code: 'matte',
        kind: 'processing',
        name: 'Матування',
        defaultPrice: 20_000,
      })
      .expect(201);
    await request(server())
      .post('/api/finishing-options')
      .set('Cookie', admin)
      .send({ code: 'matte', kind: 'processing', name: 'Дубль' })
      .expect(409);

    const reference = await request(server())
      .get('/api/storefront/reference')
      .expect(200);
    expect(
      reference.body.finishingOptions.map((item: Reference) => item.code),
    ).toContain('matte');

    await request(server())
      .patch(`/api/finishing-options/${created.body.id}`)
      .set('Cookie', admin)
      .send({ isActive: false })
      .expect(200);
    const hidden = await request(server())
      .get('/api/storefront/reference')
      .expect(200);
    expect(
      hidden.body.finishingOptions.map((item: Reference) => item.code),
    ).not.toContain('matte');
  });

  it('orders collection products as chosen by staff', async () => {
    const collection = await request(server())
      .patch(`/api/collections/${catalog.collectionId}`)
      .set('Cookie', admin)
      .send({ productIds: [catalog.earrings.id, catalog.ring.id] })
      .expect(200);
    expect(
      collection.body.products.map((product: { id: string }) => product.id),
    ).toEqual([catalog.earrings.id, catalog.ring.id]);

    const page = await request(server())
      .get('/api/storefront/collections/aurora')
      .expect(200);
    expect(
      page.body.products.map((product: { slug: string }) => product.slug),
    ).toEqual(['aurora-earrings', 'aurora-ring']);

    const removed = await request(server())
      .patch(`/api/collections/${catalog.collectionId}`)
      .set('Cookie', admin)
      .send({ productIds: [catalog.ring.id] })
      .expect(200);
    expect(removed.body.products).toHaveLength(1);
    const earrings = await request(server())
      .get(`/api/products/${catalog.earrings.id}`)
      .set('Cookie', admin)
      .expect(200);
    expect(earrings.body.collection).toBeNull();
  });
});
