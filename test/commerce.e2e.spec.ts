import request from 'supertest';
import { CatalogFixture, createCatalog } from './support/catalog.fixtures';
import { DELIVERY } from './support/order.fixtures';
import { cookieFor, createTestApp, TestContext } from './support/test.app';

describe('Favorites, cart, and orders (e2e)', () => {
  let context: TestContext;
  let catalog: CatalogFixture;
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

  it('manages favorites idempotently', async () => {
    await request(server())
      .put(`/api/customers/me/favorites/${catalog.ring.id}`)
      .set('Cookie', customer)
      .expect(204);
    await request(server())
      .put(`/api/customers/me/favorites/${catalog.ring.id}`)
      .set('Cookie', customer)
      .expect(204);
    await request(server())
      .put(`/api/customers/me/favorites/${catalog.draft.id}`)
      .set('Cookie', customer)
      .expect(404);

    const list = await request(server())
      .get('/api/customers/me/favorites')
      .set('Cookie', customer)
      .expect(200);
    expect(list.body.map((p: { slug: string }) => p.slug)).toEqual([
      'aurora-ring',
    ]);

    await request(server())
      .delete(`/api/customers/me/favorites/${catalog.ring.id}`)
      .set('Cookie', customer)
      .expect(204);
  });

  it('builds a priced cart with set discounts', async () => {
    await request(server())
      .post('/api/customers/me/cart/items')
      .set('Cookie', customer)
      .send({
        productId: catalog.ring.id,
        optionValueIds: [catalog.values.engraving],
      })
      .expect(400);

    await request(server())
      .post('/api/customers/me/cart/items')
      .set('Cookie', customer)
      .send({
        productId: catalog.ring.id,
        optionValueIds: [catalog.values.platinum, catalog.values.size175],
      })
      .expect(200);
    const merged = await request(server())
      .post('/api/customers/me/cart/items')
      .set('Cookie', customer)
      .send({
        productId: catalog.ring.id,
        optionValueIds: [catalog.values.size175, catalog.values.platinum],
      })
      .expect(200);
    expect(merged.body.items).toHaveLength(1);
    expect(merged.body.items[0]).toMatchObject({
      quantity: 2,
      unitPrice: 1_820_000,
    });

    await request(server())
      .patch(`/api/customers/me/cart/items/${merged.body.items[0].id}`)
      .set('Cookie', customer)
      .send({ quantity: 1 })
      .expect(200);

    const cart = await request(server())
      .post('/api/customers/me/cart/items')
      .set('Cookie', customer)
      .send({ productId: catalog.earrings.id })
      .expect(200);

    expect(cart.body).toMatchObject({
      subtotal: 2_320_000,
      discount: 232_000,
      total: 2_088_000,
      productionDaysMin: 15,
      productionDaysMax: 19,
      hasUnavailableItems: false,
    });
  });

  it('flags lines that exceed stock and blocks checkout', async () => {
    const cart = await request(server())
      .get('/api/customers/me/cart')
      .set('Cookie', customer)
      .expect(200);
    const earringsLine = cart.body.items.find(
      (item: { productId: string }) => item.productId === catalog.earrings.id,
    );

    const updated = await request(server())
      .patch(`/api/customers/me/cart/items/${earringsLine.id}`)
      .set('Cookie', customer)
      .send({ quantity: 3 })
      .expect(200);
    expect(updated.body.hasUnavailableItems).toBe(true);

    await request(server())
      .post('/api/customers/me/orders')
      .set('Cookie', customer)
      .send({ contactName: 'Олена', delivery: DELIVERY })
      .expect(409);

    await request(server())
      .patch(`/api/customers/me/cart/items/${earringsLine.id}`)
      .set('Cookie', customer)
      .send({ quantity: 1 })
      .expect(200);
  });

  let orderId: string;

  it('checks out the cart into an order snapshot and reserves stock', async () => {
    const response = await request(server())
      .post('/api/customers/me/orders')
      .set('Cookie', customer)
      .send({
        contactName: 'Олена',
        delivery: DELIVERY,
        saveAsDefault: true,
      })
      .expect(201);
    orderId = response.body.id;

    expect(response.body).toMatchObject({
      number: 1001,
      kind: 'catalog',
      status: 'pending_payment',
      contactPhone: '380500000002',
      total: 2_088_000,
      nextPayment: { type: 'full', amount: 2_088_000 },
      history: [{ fromStatus: null, toStatus: 'pending_payment' }],
    });
    expect(response.body).not.toHaveProperty('adminNote');
    expect(response.body.items).toHaveLength(2);

    const cart = await request(server())
      .get('/api/customers/me/cart')
      .set('Cookie', customer)
      .expect(200);
    expect(cart.body.items).toHaveLength(0);

    const product = await request(server())
      .get(`/api/products/${catalog.earrings.id}`)
      .set('Cookie', admin)
      .expect(200);
    expect(product.body.stockQuantity).toBe(1);

    const profile = await request(server())
      .get('/api/customers/me')
      .set('Cookie', customer)
      .expect(200);
    expect(profile.body.deliveryCityName).toBe('Київ');
  });

  it('keeps orders private to their owner', async () => {
    await request(server())
      .get(`/api/customers/me/orders/${orderId}`)
      .set('Cookie', cookieFor('otherCustomer'))
      .expect(404);

    const list = await request(server())
      .get('/api/customers/me/orders')
      .set('Cookie', customer)
      .expect(200);
    expect(list.body).toMatchObject({
      total: 1,
      items: [{ id: orderId, itemCount: 2 }],
    });
  });

  it('enforces admin status rules', async () => {
    const order = await request(server())
      .get(`/api/orders/${orderId}`)
      .set('Cookie', admin)
      .expect(200);
    expect(order.body.allowedTransitions).toEqual(['paid', 'cancelled']);

    await request(server())
      .patch(`/api/orders/${orderId}/status`)
      .set('Cookie', admin)
      .send({ status: 'paid' })
      .expect(409);
    await request(server())
      .patch(`/api/orders/${orderId}/status`)
      .set('Cookie', admin)
      .send({ status: 'shipped' })
      .expect(409);

    const listed = await request(server())
      .get('/api/orders?q=1001')
      .set('Cookie', admin)
      .expect(200);
    expect(listed.body.total).toBe(1);
  });

  it('lets the customer cancel an unpaid order and returns stock', async () => {
    const response = await request(server())
      .post(`/api/customers/me/orders/${orderId}/cancel`)
      .set('Cookie', customer)
      .expect(200);

    expect(response.body.status).toBe('cancelled');
    expect(response.body.nextPayment).toBeNull();

    const product = await request(server())
      .get(`/api/products/${catalog.earrings.id}`)
      .set('Cookie', admin)
      .expect(200);
    expect(product.body.stockQuantity).toBe(2);

    await request(server())
      .post(`/api/customers/me/orders/${orderId}/cancel`)
      .set('Cookie', customer)
      .expect(409);
  });

  it('adds a whole set to the cart', async () => {
    const cart = await request(server())
      .post('/api/customers/me/cart/sets/aurora')
      .set('Cookie', customer)
      .expect(200);

    expect(cart.body.items).toHaveLength(2);
    expect(cart.body).toMatchObject({
      subtotal: 1_500_000,
      discount: 150_000,
    });
  });
});
