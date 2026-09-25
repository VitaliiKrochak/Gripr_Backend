import request from 'supertest';
import { CatalogFixture, createCatalog } from './support/catalog.fixtures';
import { DELIVERY, placeOrder } from './support/order.fixtures';
import {
  cookieFor,
  createTestApp,
  TestContext,
  USERS,
} from './support/test.app';

interface Step {
  id: string;
  state: string;
  stage: { code: string };
  note: string | null;
  startedAt: string | null;
  completedAt: string | null;
  visibleToCustomer?: boolean;
}

interface Order {
  id: string;
  kind: string;
  status: string;
  total: number;
  depositAmount: number | null;
  items: Array<{ id: string; productName: string; productionSteps: Step[] }>;
}

const cloudinaryImage = (publicId: string) => ({
  publicId,
  url: `https://res.cloudinary.com/demo-cloud/image/upload/v1/${publicId}.jpg`,
});

describe('Production and custom requests (e2e)', () => {
  let context: TestContext;
  let catalog: CatalogFixture;
  const customer = cookieFor('customer');
  const other = cookieFor('otherCustomer');
  const admin = cookieFor('admin');

  beforeAll(async () => {
    context = await createTestApp();
    catalog = await createCatalog(context.app.getHttpServer());
  });

  afterAll(async () => {
    await context.close();
  });

  const server = () => context.app.getHttpServer();

  it('manages the production stage dictionary', async () => {
    const list = await request(server())
      .get('/api/production-stages')
      .set('Cookie', admin)
      .expect(200);
    expect(list.body.map((stage: { code: string }) => stage.code)).toContain(
      'fitting-print',
    );

    await request(server())
      .get('/api/production-stages')
      .set('Cookie', customer)
      .expect(403);

    const created = await request(server())
      .post('/api/production-stages')
      .set('Cookie', admin)
      .send({ code: 'engraving', name: 'Гравіювання', sortOrder: 55 })
      .expect(201);
    await request(server())
      .post('/api/production-stages')
      .set('Cookie', admin)
      .send({ code: 'engraving', name: 'Дублікат' })
      .expect(409);
    await request(server())
      .patch(`/api/production-stages/${created.body.id}`)
      .set('Cookie', admin)
      .send({ isActive: false })
      .expect(200);
    await request(server())
      .delete(`/api/production-stages/${created.body.id}`)
      .set('Cookie', admin)
      .expect(204);
  });

  it('tracks production steps with a customer-facing timeline', async () => {
    const placed = await placeOrder(server(), catalog.ring.id);
    const detail = await request(server())
      .get(`/api/orders/${placed.id}`)
      .set('Cookie', admin)
      .expect(200);
    const itemId = (detail.body as Order).items[0].id;

    const applied = await request(server())
      .post(`/api/orders/${placed.id}/items/${itemId}/production-steps`)
      .set('Cookie', admin)
      .send({})
      .expect(201);
    const steps = (applied.body as Order).items[0].productionSteps;
    expect(steps.map((step) => step.stage.code)).toEqual([
      'casting',
      'stone-setting',
      'polishing',
      'quality-check',
      'ready',
    ]);

    await request(server())
      .post(`/api/orders/${placed.id}/items/${itemId}/production-steps`)
      .set('Cookie', admin)
      .send({})
      .expect(201);

    const casting = steps[0];
    const started = await request(server())
      .patch(`/api/production-steps/${casting.id}`)
      .set('Cookie', admin)
      .send({
        state: 'done',
        note: 'Відлито з золота',
        images: [cloudinaryImage('jewelry/production/cast-1')],
      })
      .expect(200);
    const updated = (started.body as Order).items[0].productionSteps[0];
    expect(updated).toMatchObject({ state: 'done', note: 'Відлито з золота' });
    expect(updated.startedAt).not.toBeNull();
    expect(updated.completedAt).not.toBeNull();

    await request(server())
      .patch(`/api/production-steps/${casting.id}`)
      .set('Cookie', admin)
      .send({ images: [cloudinaryImage('elsewhere/photo')] })
      .expect(400);

    await request(server())
      .patch(`/api/production-steps/${steps[4].id}`)
      .set('Cookie', admin)
      .send({ visibleToCustomer: false })
      .expect(200);
    const afterDelete = await request(server())
      .delete(`/api/production-steps/${steps[3].id}`)
      .set('Cookie', admin)
      .expect(200);
    expect((afterDelete.body as Order).items[0].productionSteps).toHaveLength(
      4,
    );

    const timeline = await request(server())
      .get(`/api/customers/me/orders/${placed.id}`)
      .set('Cookie', customer)
      .expect(200);
    const customerSteps = (timeline.body as Order).items[0].productionSteps;
    expect(customerSteps.map((step) => step.stage.code)).toEqual([
      'casting',
      'stone-setting',
      'polishing',
    ]);
    expect(customerSteps[0]).not.toHaveProperty('visibleToCustomer');
  });

  it('turns an accepted custom request quote into a deposit order', async () => {
    const ownFolder = `jewelry/custom-requests/${USERS.customer.id}`;

    await request(server())
      .post('/api/customers/me/custom-requests')
      .set('Cookie', customer)
      .send({
        productType: 'ring',
        description: 'Каблучка з сапфіром у вінтажному стилі',
        referenceImages: [
          cloudinaryImage(
            `jewelry/custom-requests/${USERS.otherCustomer.id}/x`,
          ),
        ],
      })
      .expect(400);

    const created = await request(server())
      .post('/api/customers/me/custom-requests')
      .set('Cookie', customer)
      .send({
        productType: 'ring',
        description: 'Каблучка з сапфіром у вінтажному стилі',
        referenceImages: [cloudinaryImage(`${ownFolder}/ref-1`)],
        budgetMin: 2_000_000,
        budgetMax: 3_000_000,
        ringSize: 17,
      })
      .expect(201);
    const id = created.body.id as string;
    expect(created.body).toMatchObject({ status: 'new', quote: null });

    await request(server())
      .get(`/api/customers/me/custom-requests/${id}`)
      .set('Cookie', other)
      .expect(404);
    await request(server())
      .post(`/api/customers/me/custom-requests/${id}/accept`)
      .set('Cookie', customer)
      .send({ contactName: 'Олена', delivery: DELIVERY })
      .expect(409);

    const listed = await request(server())
      .get('/api/custom-requests?status=new')
      .set('Cookie', admin)
      .expect(200);
    expect(listed.body.items[0]).toMatchObject({
      id,
      customer: { id: USERS.customer.id },
    });

    await request(server())
      .patch(`/api/custom-requests/${id}`)
      .set('Cookie', admin)
      .send({ status: 'in_review', adminNote: 'Потрібен сапфір 1 карат' })
      .expect(200);
    await request(server())
      .post(`/api/custom-requests/${id}/quote`)
      .set('Cookie', admin)
      .send({
        title: 'Каблучка з сапфіром',
        price: 2_500_000,
        depositAmount: 3_000_000,
        productionDaysMin: 20,
        productionDaysMax: 30,
      })
      .expect(400);
    await request(server())
      .post(`/api/custom-requests/${id}/quote`)
      .set('Cookie', admin)
      .send({
        title: 'Каблучка з сапфіром',
        price: 2_500_000,
        depositAmount: 750_000,
        productionDaysMin: 20,
        productionDaysMax: 30,
        note: 'Сапфір 1 карат, біле золото 585',
      })
      .expect(200);

    const quoted = await request(server())
      .get(`/api/customers/me/custom-requests/${id}`)
      .set('Cookie', customer)
      .expect(200);
    expect(quoted.body).toMatchObject({
      status: 'quoted',
      quote: { price: 2_500_000, depositAmount: 750_000 },
    });
    expect(quoted.body).not.toHaveProperty('adminNote');

    const accepted = await request(server())
      .post(`/api/customers/me/custom-requests/${id}/accept`)
      .set('Cookie', customer)
      .send({ contactName: 'Олена', delivery: DELIVERY })
      .expect(200);
    expect(accepted.body.status).toBe('accepted');

    const order = await request(server())
      .get(`/api/orders/${accepted.body.orderId}`)
      .set('Cookie', admin)
      .expect(200);
    expect(order.body).toMatchObject({
      kind: 'custom',
      status: 'pending_payment',
      total: 2_500_000,
      depositAmount: 750_000,
      items: [{ productName: 'Каблучка з сапфіром' }],
    });

    const payment = await request(server())
      .post(`/api/customers/me/orders/${accepted.body.orderId}/payments`)
      .set('Cookie', customer)
      .expect(201);
    expect(payment.body).toMatchObject({ type: 'deposit', amount: 750_000 });

    const itemId = (order.body as Order).items[0].id;
    const withSteps = await request(server())
      .post(
        `/api/orders/${accepted.body.orderId}/items/${itemId}/production-steps`,
      )
      .set('Cookie', admin)
      .send({})
      .expect(201);
    expect(
      (withSteps.body as Order).items[0].productionSteps
        .slice(0, 3)
        .map((step) => step.stage.code),
    ).toEqual(['modeling', 'model-approval', 'fitting-print']);

    await request(server())
      .post(`/api/customers/me/custom-requests/${id}/decline`)
      .set('Cookie', customer)
      .expect(409);
  });
});
