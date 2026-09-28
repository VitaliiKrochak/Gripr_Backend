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
      .send({ code: 'packaging', name: 'Пакування', sortOrder: 85 })
      .expect(201);
    await request(server())
      .post('/api/production-stages')
      .set('Cookie', admin)
      .send({ code: 'packaging', name: 'Дублікат' })
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
      'pre-processing',
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
      .patch(`/api/production-steps/${steps[5].id}`)
      .set('Cookie', admin)
      .send({ visibleToCustomer: false })
      .expect(200);
    const afterDelete = await request(server())
      .delete(`/api/production-steps/${steps[4].id}`)
      .set('Cookie', admin)
      .expect(200);
    const remaining = (afterDelete.body as Order).items[0].productionSteps;
    expect(remaining).toHaveLength(5);

    const reorderUrl = `/api/orders/${placed.id}/items/${itemId}/production-steps/order`;
    await request(server())
      .put(reorderUrl)
      .set('Cookie', admin)
      .send({ ids: remaining.slice(1).map((step) => step.id) })
      .expect(400);
    const reordered = await request(server())
      .put(reorderUrl)
      .set('Cookie', admin)
      .send({
        ids: [
          remaining[0].id,
          remaining[2].id,
          remaining[1].id,
          ...remaining.slice(3).map((step) => step.id),
        ],
      })
      .expect(200);
    expect(
      (reordered.body as Order).items[0].productionSteps.map(
        (step) => step.stage.code,
      ),
    ).toEqual([
      'casting',
      'stone-setting',
      'pre-processing',
      'polishing',
      'ready',
    ]);

    const timeline = await request(server())
      .get(`/api/customers/me/orders/${placed.id}`)
      .set('Cookie', customer)
      .expect(200);
    const customerSteps = (timeline.body as Order).items[0].productionSteps;
    expect(customerSteps.map((step) => step.stage.code)).toEqual([
      'casting',
      'stone-setting',
      'pre-processing',
      'polishing',
    ]);
    expect(customerSteps[0]).not.toHaveProperty('visibleToCustomer');
  });

  it('turns an approved proposal into a staged custom order', async () => {
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

    const proposal = {
      title: 'Каблучка з сапфіром',
      specification: {
        productType: 'ring',
        metalMode: 'specified',
        metal: { name: 'Біле золото 585' },
        size: 17,
        stoneMode: 'specified',
        stones: [{ name: 'Сапфір', sizeMm: 6, quantity: 1 }],
        processing: [{ name: 'Попередня обробка' }],
      },
      requiresModel: true,
      modelPrice: 200_000,
      productPrice: 2_500_000,
      productionPrepayment: 1_000_000,
      productionDaysMin: 20,
      productionDaysMax: 30,
    };
    await request(server())
      .post(`/api/custom-requests/${id}/proposals`)
      .set('Cookie', admin)
      .send({ ...proposal, productionPrepayment: 3_000_000 })
      .expect(400);
    await request(server())
      .post(`/api/custom-requests/${id}/proposals`)
      .set('Cookie', admin)
      .send(proposal)
      .expect(200);

    await request(server())
      .post(`/api/customers/me/custom-requests/${id}/request-changes`)
      .set('Cookie', customer)
      .send({ comment: 'Хочу камінь трохи менший' })
      .expect(200);
    await request(server())
      .post(`/api/customers/me/custom-requests/${id}/accept`)
      .set('Cookie', customer)
      .send({ contactName: 'Олена', delivery: DELIVERY })
      .expect(409);

    await request(server())
      .post(`/api/custom-requests/${id}/proposals`)
      .set('Cookie', admin)
      .send({
        ...proposal,
        specification: {
          ...proposal.specification,
          stones: [{ name: 'Сапфір', sizeMm: 5, quantity: 1 }],
        },
        note: 'Сапфір 5 мм, біле золото 585',
      })
      .expect(200);

    const quoted = await request(server())
      .get(`/api/customers/me/custom-requests/${id}`)
      .set('Cookie', customer)
      .expect(200);
    expect(quoted.body).toMatchObject({
      status: 'quoted',
      ringSize: 17,
      specification: null,
      proposal: {
        version: 2,
        status: 'sent',
        totalPrice: 2_700_000,
        specification: { stones: [{ sizeMm: 5 }] },
      },
      proposals: [
        { version: 2 },
        {
          version: 1,
          status: 'superseded',
          customerResponse: 'Хочу камінь трохи менший',
        },
      ],
      quote: { price: 2_700_000 },
    });
    expect(quoted.body).not.toHaveProperty('adminNote');

    const accepted = await request(server())
      .post(`/api/customers/me/custom-requests/${id}/accept`)
      .set('Cookie', customer)
      .send({ contactName: 'Олена', delivery: DELIVERY })
      .expect(200);
    expect(accepted.body).toMatchObject({
      status: 'accepted',
      proposal: { status: 'approved' },
    });
    const orderId = accepted.body.orderId as string;
    const orderUrl = `/api/orders/${orderId}`;

    const order = await request(server())
      .get(orderUrl)
      .set('Cookie', admin)
      .expect(200);
    expect(order.body).toMatchObject({
      kind: 'custom',
      status: 'awaiting_model_payment',
      total: 2_700_000,
      depositAmount: null,
      modelPaymentAmount: 200_000,
      productionPaymentAmount: 1_000_000,
      customRequestId: id,
      items: [
        {
          productName: 'Каблучка з сапфіром',
          specification: { metal: { name: 'Біле золото 585' } },
        },
      ],
    });

    const payment = await request(server())
      .post(`/api/customers/me/orders/${orderId}/payments`)
      .set('Cookie', customer)
      .expect(201);
    expect(payment.body).toMatchObject({
      type: 'model_prepayment',
      amount: 200_000,
    });

    const modeling = await request(server())
      .post(`${orderUrl}/payments`)
      .set('Cookie', admin)
      .send({ amount: 200_000 })
      .expect(201);
    expect(modeling.body.status).toBe('modeling');
    await request(server())
      .patch(`${orderUrl}/status`)
      .set('Cookie', admin)
      .send({ status: 'model_review' })
      .expect(200);

    const customerOrderUrl = `/api/customers/me/orders/${orderId}`;
    const revised = await request(server())
      .post(`${customerOrderUrl}/model/request-changes`)
      .set('Cookie', customer)
      .send({ comment: 'Зробіть шинку тоншою' })
      .expect(200);
    expect(revised.body.status).toBe('modeling');
    await request(server())
      .post(`${customerOrderUrl}/model/approve`)
      .set('Cookie', customer)
      .expect(409);
    await request(server())
      .patch(`${orderUrl}/status`)
      .set('Cookie', admin)
      .send({ status: 'model_review' })
      .expect(200);
    await request(server())
      .post(`${customerOrderUrl}/model/approve`)
      .set('Cookie', other)
      .expect(404);
    const approved = await request(server())
      .post(`${customerOrderUrl}/model/approve`)
      .set('Cookie', customer)
      .expect(200);
    expect(approved.body).toMatchObject({
      status: 'awaiting_production_payment',
      nextPayment: { type: 'production_prepayment', amount: 1_000_000 },
    });

    await request(server())
      .patch(`${orderUrl}/status`)
      .set('Cookie', admin)
      .send({ status: 'in_production' })
      .expect(409);
    const producing = await request(server())
      .post(`${orderUrl}/payments`)
      .set('Cookie', admin)
      .send({ amount: 1_000_000 })
      .expect(201);
    expect(producing.body.status).toBe('in_production');

    const itemId = (order.body as Order).items[0].id;
    const withSteps = await request(server())
      .post(`${orderUrl}/items/${itemId}/production-steps`)
      .set('Cookie', admin)
      .send({})
      .expect(201);
    expect(
      (withSteps.body as Order).items[0].productionSteps
        .slice(0, 3)
        .map((step) => step.stage.code),
    ).toEqual(['modeling', 'model-approval', 'fitting-print']);

    await request(server())
      .patch(`${orderUrl}/status`)
      .set('Cookie', admin)
      .send({ status: 'awaiting_final_payment' })
      .expect(200);
    const ready = await request(server())
      .post(`${orderUrl}/payments`)
      .set('Cookie', admin)
      .send({ amount: 1_500_000 })
      .expect(201);
    expect(ready.body.status).toBe('ready');

    const messages = await request(server())
      .get(`${customerOrderUrl}/messages`)
      .set('Cookie', customer)
      .expect(200);
    expect(
      messages.body.map((message: { body: string; thread: string }) => [
        message.thread,
        message.body,
      ]),
    ).toEqual([
      ['request', 'Хочу камінь трохи менший'],
      ['order', 'Зробіть шинку тоншою'],
    ]);

    await request(server())
      .post(`/api/customers/me/custom-requests/${id}/decline`)
      .set('Cookie', customer)
      .expect(409);
  });

  it('keeps a conversation with attachments per order', async () => {
    const placed = await placeOrder(server(), catalog.ring.id);
    const stages = (
      await request(server())
        .get('/api/production-stages')
        .set('Cookie', admin)
        .expect(200)
    ).body as Array<{ id: string; code: string }>;
    const casting = stages.find((stage) => stage.code === 'casting')!;

    await request(server())
      .post(`/api/customers/me/orders/${placed.id}/messages`)
      .set('Cookie', customer)
      .send({})
      .expect(400);
    await request(server())
      .post(`/api/customers/me/orders/${placed.id}/messages`)
      .set('Cookie', customer)
      .send({
        attachments: [cloudinaryImage('jewelry/products/not-mine')],
      })
      .expect(400);
    await request(server())
      .post(`/api/customers/me/orders/${placed.id}/messages`)
      .set('Cookie', other)
      .send({ body: 'Чуже замовлення' })
      .expect(404);
    await request(server())
      .post(`/api/customers/me/orders/${placed.id}/messages`)
      .set('Cookie', customer)
      .send({
        body: 'Ось фото бажаного відтінку',
        attachments: [
          cloudinaryImage(`jewelry/custom-requests/${USERS.customer.id}/tone`),
        ],
      })
      .expect(201);
    const thread = await request(server())
      .post(`/api/orders/${placed.id}/messages`)
      .set('Cookie', admin)
      .send({
        body: 'Відливок готовий',
        stageId: casting.id,
        attachments: [cloudinaryImage('jewelry/messages/cast')],
      })
      .expect(201);

    expect(thread.body).toMatchObject([
      { authorRole: 'customer', attachments: [{}] },
      { authorRole: 'staff', stage: { code: 'casting' }, thread: 'order' },
    ]);
  });

  it('asks the workshop to customize a catalog product', async () => {
    const customization = await request(server())
      .post('/api/customers/me/custom-requests')
      .set('Cookie', customer)
      .send({
        productType: 'brooch',
        description: 'Хочу цю каблучку з гравіюванням імені',
        productId: catalog.ring.id,
        optionValueIds: [catalog.values.size175],
        specification: {
          productType: 'ring',
          metalMode: 'recommend',
          stoneMode: 'none',
          stones: [],
          engraving: { name: 'Лазерне гравіювання', text: ' Олена ' },
          timeline: 'до 14 лютого',
        },
      })
      .expect(201);
    expect(customization.body).toMatchObject({
      source: 'customization',
      productType: 'ring',
      product: { id: catalog.ring.id, slug: 'aurora-ring' },
      baseOptions: [
        { kind: 'metal', label: 'Жовте золото 585' },
        { kind: 'size', label: '17.5', priceDelta: 20_000 },
      ],
      specification: {
        metal: null,
        engraving: { name: 'Лазерне гравіювання', text: 'Олена' },
        timeline: 'до 14 лютого',
      },
    });

    await request(server())
      .post('/api/customers/me/custom-requests')
      .set('Cookie', customer)
      .send({
        productType: 'ring',
        description: 'Хочу чернетку з іншим металом',
        productId: catalog.draft.id,
      })
      .expect(400);

    const listed = await request(server())
      .get('/api/custom-requests?source=customization')
      .set('Cookie', admin)
      .expect(200);
    expect(listed.body.items.map((item: { id: string }) => item.id)).toEqual([
      customization.body.id,
    ]);

    const withoutModel = await request(server())
      .post(`/api/custom-requests/${customization.body.id}/proposals`)
      .set('Cookie', admin)
      .send({
        title: 'Каблучка Aurora з гравіюванням',
        specification: customization.body.specification,
        requiresModel: false,
        modelPrice: 100_000,
        productPrice: 1_100_000,
        productionPrepayment: 0,
        productionDaysMin: 10,
        productionDaysMax: 14,
      })
      .expect(200);
    expect(withoutModel.body.proposal).toMatchObject({
      modelPrice: 0,
      totalPrice: 1_100_000,
    });

    const accepted = await request(server())
      .post(`/api/customers/me/custom-requests/${customization.body.id}/accept`)
      .set('Cookie', customer)
      .send({ contactName: 'Олена', delivery: DELIVERY })
      .expect(200);
    const order = await request(server())
      .get(`/api/orders/${accepted.body.orderId}`)
      .set('Cookie', admin)
      .expect(200);
    expect(order.body).toMatchObject({
      status: 'in_production',
      total: 1_100_000,
      nextPayment: { type: 'remainder', amount: 1_100_000 },
    });

    const withSteps = await request(server())
      .post(
        `/api/orders/${accepted.body.orderId}/items/${order.body.items[0].id}/production-steps`,
      )
      .set('Cookie', admin)
      .send({})
      .expect(201);
    const codes = (withSteps.body as Order).items[0].productionSteps.map(
      (step) => step.stage.code,
    );
    expect(codes).toContain('engraving');
    expect(codes).not.toContain('modeling');
  });
});
