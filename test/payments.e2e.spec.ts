import { createHash } from 'node:crypto';
import request from 'supertest';
import { CatalogFixture, createCatalog } from './support/catalog.fixtures';
import { placeOrder } from './support/order.fixtures';
import { cookieFor, createTestApp, TestContext } from './support/test.app';

interface Checkout {
  paymentId: string;
  type: string;
  amount: number;
  checkoutUrl: string;
  data: string;
  signature: string;
}

function callback(payload: object): { data: string; signature: string } {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = createHash('sha3-256')
    .update(`liqpay-private${data}liqpay-private`)
    .digest('base64');
  return { data, signature };
}

describe('Payments (e2e)', () => {
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

  const startPayment = async (orderId: string): Promise<Checkout> =>
    (
      await request(server())
        .post(`/api/customers/me/orders/${orderId}/payments`)
        .set('Cookie', customer)
        .expect(201)
    ).body as Checkout;

  const postCallback = (payload: object) =>
    request(server())
      .post('/api/payments/liqpay/callback')
      .type('form')
      .send(callback(payload));

  it('pays an order through a verified, idempotent LiqPay callback', async () => {
    const order = await placeOrder(server(), catalog.earrings.id);
    const checkout = await startPayment(order.id);

    expect(checkout).toMatchObject({
      type: 'full',
      amount: order.total,
      checkoutUrl: 'https://www.liqpay.ua/api/3/checkout',
    });
    const payload = JSON.parse(
      Buffer.from(checkout.data, 'base64').toString(),
    ) as { rro_info: unknown };
    expect(payload.rro_info).toEqual({
      items: [
        {
          id: 777,
          amount: 1,
          price: order.total / 100,
          cost: order.total / 100,
        },
      ],
    });

    const success = {
      order_id: checkout.paymentId,
      status: 'sandbox',
      amount: order.total / 100,
      currency: 'UAH',
      payment_id: 42,
    };
    await postCallback(success).expect(200);
    await postCallback(success).expect(200);

    const paid = await request(server())
      .get(`/api/customers/me/orders/${order.id}`)
      .set('Cookie', customer)
      .expect(200);
    expect(paid.body).toMatchObject({
      status: 'paid',
      paidAmount: order.total,
    });

    await request(server())
      .post(`/api/customers/me/orders/${order.id}/payments`)
      .set('Cookie', customer)
      .expect(409);
  });

  it('rejects forged callbacks and ignores mismatched amounts', async () => {
    const order = await placeOrder(server(), catalog.earrings.id);
    const checkout = await startPayment(order.id);

    await request(server())
      .post('/api/payments/liqpay/callback')
      .type('form')
      .send({ data: callback({}).data, signature: 'forged' })
      .expect(400);

    await postCallback({
      order_id: checkout.paymentId,
      status: 'success',
      amount: 1,
      currency: 'UAH',
    }).expect(200);

    const detail = await request(server())
      .get(`/api/orders/${order.id}`)
      .set('Cookie', admin)
      .expect(200);
    expect(detail.body).toMatchObject({
      status: 'pending_payment',
      paidAmount: 0,
    });
    expect(detail.body.payments).toEqual([
      expect.objectContaining({ status: 'failure', providerStatus: 'success' }),
    ]);
  });

  it('lets admins record manual payments', async () => {
    const order = await placeOrder(server(), catalog.ring.id);

    await request(server())
      .post(`/api/orders/${order.id}/payments`)
      .set('Cookie', customer)
      .send({ amount: 100 })
      .expect(403);

    const partial = await request(server())
      .post(`/api/orders/${order.id}/payments`)
      .set('Cookie', admin)
      .send({ amount: 100_000, note: 'Готівка в шоурумі' })
      .expect(201);
    expect(partial.body).toMatchObject({
      status: 'paid',
      paidAmount: 100_000,
    });

    const remainder = await startPayment(order.id);
    expect(remainder).toMatchObject({
      type: 'remainder',
      amount: order.total - 100_000,
    });
  });
});
