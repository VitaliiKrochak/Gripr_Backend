import { createHash } from 'node:crypto';
import request from 'supertest';
import { CatalogFixture, createCatalog } from './support/catalog.fixtures';
import { DELIVERY } from './support/order.fixtures';
import { cookieFor, createTestApp, TestContext } from './support/test.app';

function encodeCallback(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function liqPaySignature(privateKey: string, data: string): string {
  return createHash('sha3-256')
    .update(privateKey + data + privateKey)
    .digest('base64');
}

interface Stage {
  id: string;
  code: string;
  store: string;
}

describe('Gripr and Gripr Lab stores (e2e)', () => {
  let context: TestContext;
  let catalog: CatalogFixture;
  let figurine: { id: string; slug: string; store: string };
  let labCollectionId: string;
  let labTagId: string;
  const customer = cookieFor('customer');
  const admin = cookieFor('admin');

  beforeAll(async () => {
    context = await createTestApp();
    catalog = await createCatalog(context.app.getHttpServer());
  });

  afterAll(async () => {
    await context.close();
  });

  const server = () => context.app.getHttpServer();

  it('derives the store from the product type and keeps references in it', async () => {
    const labTag = await request(server())
      .post('/api/tags')
      .set('Cookie', admin)
      .send({ store: 'lab', slug: 'fantasy', name: 'Фентезі' })
      .expect(201);
    labTagId = labTag.body.id;
    expect(labTag.body.store).toBe('lab');

    const labCollection = await request(server())
      .post('/api/collections')
      .set('Cookie', admin)
      .send({
        store: 'lab',
        slug: 'dragons',
        name: 'Дракони',
        status: 'published',
      })
      .expect(201);
    labCollectionId = labCollection.body.id;

    await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send({
        slug: 'lost-dragon',
        name: 'Дракон',
        type: 'figurine',
        basePrice: 9_000,
        collectionId: catalog.collectionId,
      })
      .expect(400);
    await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send({
        slug: 'lost-dragon',
        name: 'Дракон',
        type: 'figurine',
        basePrice: 9_000,
        tagIds: [catalog.tagId],
      })
      .expect(400);
    await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send({
        slug: 'lost-dragon',
        name: 'Дракон',
        type: 'figurine',
        basePrice: 9_000,
        optionGroups: [{ kind: 'metal', name: 'Метал', values: [] }],
      })
      .expect(400);

    const created = await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send({
        slug: 'red-dragon',
        name: 'Червоний дракон',
        type: 'figurine',
        status: 'published',
        basePrice: 9_000,
        collectionId: labCollectionId,
        tagIds: [labTagId],
      })
      .expect(201);
    figurine = created.body;
    expect(figurine.store).toBe('lab');

    await request(server())
      .post(`/api/products/${figurine.id}/option-groups`)
      .set('Cookie', admin)
      .send({ kind: 'stone', name: 'Камінь' })
      .expect(400);
    await request(server())
      .post(`/api/products/${figurine.id}/option-groups`)
      .set('Cookie', admin)
      .send({ kind: 'resin', name: 'Смола', isRequired: false })
      .expect(201);
    await request(server())
      .patch(`/api/products/${figurine.id}`)
      .set('Cookie', admin)
      .send({ type: 'ring' })
      .expect(400);
    await request(server())
      .patch(`/api/products/${figurine.id}`)
      .set('Cookie', admin)
      .send({ type: 'miniature' })
      .expect(200);
    await request(server())
      .patch(`/api/products/${catalog.ring.id}`)
      .set('Cookie', admin)
      .send({ tagIds: [labTagId] })
      .expect(400);
    await request(server())
      .patch(`/api/collections/${labCollectionId}`)
      .set('Cookie', admin)
      .send({ productIds: [figurine.id, catalog.earrings.id] })
      .expect(400);
  });

  it('lists each store separately in the admin and the storefront', async () => {
    const slugs = (body: unknown) =>
      (body as { items: Array<{ slug: string }> }).items.map(
        (item) => item.slug,
      );

    const gripr = await request(server())
      .get('/api/products')
      .set('Cookie', admin)
      .expect(200);
    expect(slugs(gripr.body)).not.toContain('red-dragon');
    const lab = await request(server())
      .get('/api/products?store=lab')
      .set('Cookie', admin)
      .expect(200);
    expect(slugs(lab.body)).toEqual(['red-dragon']);

    const tags = await request(server())
      .get('/api/tags?store=lab')
      .set('Cookie', admin)
      .expect(200);
    expect(tags.body.map((tag: { slug: string }) => tag.slug)).toEqual([
      'fantasy',
    ]);

    const storefront = await request(server())
      .get('/api/storefront/products')
      .expect(200);
    expect(slugs(storefront.body)).not.toContain('red-dragon');
    const labStorefront = await request(server())
      .get('/api/storefront/products?store=lab')
      .expect(200);
    expect(labStorefront.body.items).toEqual([
      expect.objectContaining({ slug: 'red-dragon', store: 'lab' }),
    ]);

    await request(server())
      .get('/api/storefront/products/red-dragon')
      .expect(404);
    await request(server())
      .get('/api/storefront/products/aurora-ring?store=lab')
      .expect(404);
    const product = await request(server())
      .get('/api/storefront/products/red-dragon?store=lab')
      .expect(200);
    expect(product.body).toMatchObject({ store: 'lab', type: 'miniature' });

    const filters = await request(server())
      .get('/api/storefront/filters?store=lab')
      .expect(200);
    expect(filters.body).toMatchObject({
      types: ['miniature'],
      metals: [],
      gemstones: [],
      collections: [expect.objectContaining({ slug: 'dragons' })],
    });

    const collections = await request(server())
      .get('/api/storefront/collections?store=lab')
      .expect(200);
    expect(
      collections.body.map((collection: { slug: string }) => collection.slug),
    ).toEqual(['dragons']);
    await request(server())
      .get('/api/storefront/collections/dragons')
      .expect(404);
  });

  let labOrder: { id: string; number: number; reference: string };

  it('keeps one cart per store and checks out only the chosen store', async () => {
    await request(server())
      .post('/api/customers/me/cart/items')
      .set('Cookie', customer)
      .send({ productId: catalog.ring.id })
      .expect(200);
    const added = await request(server())
      .post('/api/customers/me/cart/items')
      .set('Cookie', customer)
      .send({ productId: figurine.id })
      .expect(200);
    expect(added.body).toMatchObject({
      store: 'lab',
      items: [expect.objectContaining({ productId: figurine.id })],
      total: 9_000,
    });

    const griprCart = await request(server())
      .get('/api/customers/me/cart')
      .set('Cookie', customer)
      .expect(200);
    expect(griprCart.body.store).toBe('gripr');
    expect(
      griprCart.body.items.map((item: { productId: string }) => item.productId),
    ).toEqual([catalog.ring.id]);

    const checkout = await request(server())
      .post('/api/customers/me/orders')
      .set('Cookie', customer)
      .send({ store: 'lab', contactName: 'Олена', delivery: DELIVERY })
      .expect(201);
    labOrder = checkout.body;
    expect(checkout.body).toMatchObject({
      store: 'lab',
      total: 9_000,
      reference: `LAB-${checkout.body.number}`,
      items: [expect.objectContaining({ productId: figurine.id })],
    });

    const labCart = await request(server())
      .get('/api/customers/me/cart?store=lab')
      .set('Cookie', customer)
      .expect(200);
    expect(labCart.body.items).toEqual([]);
    const remaining = await request(server())
      .get('/api/customers/me/cart')
      .set('Cookie', customer)
      .expect(200);
    expect(remaining.body.items).toHaveLength(1);

    const griprOrders = await request(server())
      .get('/api/customers/me/orders')
      .set('Cookie', customer)
      .expect(200);
    expect(griprOrders.body.items).toEqual([]);
    const labOrders = await request(server())
      .get('/api/customers/me/orders?store=lab')
      .set('Cookie', customer)
      .expect(200);
    expect(labOrders.body.items).toEqual([
      expect.objectContaining({
        id: labOrder.id,
        reference: labOrder.reference,
      }),
    ]);

    await request(server())
      .delete('/api/customers/me/cart')
      .set('Cookie', customer)
      .expect(204);
  });

  it('finds Lab orders by reference only in the Lab admin', async () => {
    const found = await request(server())
      .get(`/api/orders?store=lab&q=${labOrder.reference}`)
      .set('Cookie', admin)
      .expect(200);
    expect(found.body.items.map((order: { id: string }) => order.id)).toEqual([
      labOrder.id,
    ]);

    const elsewhere = await request(server())
      .get(`/api/orders?q=${labOrder.reference}`)
      .set('Cookie', admin)
      .expect(200);
    expect(elsewhere.body.items).toEqual([]);
  });

  it('applies Lab production stages to Lab orders', async () => {
    const stages = (
      await request(server())
        .get('/api/production-stages?store=lab')
        .set('Cookie', admin)
        .expect(200)
    ).body as Stage[];
    expect(stages.every((stage) => stage.store === 'lab')).toBe(true);
    expect(stages.map((stage) => stage.code)).toContain('lab-painting');

    const griprStages = (
      await request(server())
        .get('/api/production-stages')
        .set('Cookie', admin)
        .expect(200)
    ).body as Stage[];
    const detail = await request(server())
      .get(`/api/orders/${labOrder.id}`)
      .set('Cookie', admin)
      .expect(200);
    const itemId = detail.body.items[0].id;

    await request(server())
      .post(`/api/orders/${labOrder.id}/items/${itemId}/production-steps`)
      .set('Cookie', admin)
      .send({ stageIds: [griprStages[0].id] })
      .expect(400);

    const applied = await request(server())
      .post(`/api/orders/${labOrder.id}/items/${itemId}/production-steps`)
      .set('Cookie', admin)
      .send({})
      .expect(201);
    expect(
      applied.body.items[0].productionSteps.map(
        (step: { stage: { code: string } }) => step.stage.code,
      ),
    ).toEqual([
      'lab-file-check',
      'lab-printing',
      'lab-washing-curing',
      'lab-support-removal',
      'lab-sanding',
      'lab-quality-check',
      'lab-packing',
    ]);
  });

  it('summarises each store on the dashboard', async () => {
    const lab = await request(server())
      .get('/api/dashboard/summary?store=lab')
      .set('Cookie', admin)
      .expect(200);
    expect(lab.body).toMatchObject({
      ordersByStatus: { pending_payment: 1 },
      publishedProducts: 1,
    });

    const gripr = await request(server())
      .get('/api/dashboard/summary')
      .set('Cookie', admin)
      .expect(200);
    expect(gripr.body).toMatchObject({
      ordersByStatus: { pending_payment: 0 },
      publishedProducts: 2,
    });
  });

  it('takes Lab payments into the Lab LiqPay account only', async () => {
    const checkout = (
      await request(server())
        .post(`/api/customers/me/orders/${labOrder.id}/payments`)
        .set('Cookie', customer)
        .expect(201)
    ).body as { paymentId: string; data: string; signature: string };
    const payload = JSON.parse(
      Buffer.from(checkout.data, 'base64').toString(),
    ) as { public_key: string; rro_info: { items: { id: number }[] } };
    expect(payload.public_key).toBe('liqpay-lab-public');
    expect(payload.rro_info.items).toEqual([
      expect.objectContaining({ id: 888, price: 90 }),
    ]);
    expect(checkout.signature).toBe(
      liqPaySignature('liqpay-lab-private', checkout.data),
    );

    const success = encodeCallback({
      order_id: checkout.paymentId,
      status: 'sandbox',
      amount: 90,
      currency: 'UAH',
    });
    await request(server())
      .post('/api/payments/liqpay/callback')
      .type('form')
      .send({
        data: success,
        signature: liqPaySignature('liqpay-private', success),
      })
      .expect(400);
    await request(server())
      .post('/api/payments/liqpay/callback')
      .type('form')
      .send({
        data: success,
        signature: liqPaySignature('liqpay-lab-private', success),
      })
      .expect(200);

    const order = await request(server())
      .get(`/api/orders/${labOrder.id}`)
      .set('Cookie', admin)
      .expect(200);
    expect(order.body).toMatchObject({ status: 'paid', paidAmount: 9_000 });
    expect(order.body.payments).toEqual([
      expect.objectContaining({
        merchant: 'lab',
        provider: 'liqpay',
        status: 'success',
      }),
    ]);
  });
});
