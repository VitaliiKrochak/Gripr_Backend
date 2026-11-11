import { eq } from 'drizzle-orm';
import request from 'supertest';
import {
  customRequests,
  printFiles,
} from '../src/integrations/database/database.schema';
import { PERSONAL_USE_LICENSE } from '../src/modules/orders/order.modeling';
import { PrintFilesService } from '../src/modules/prints/print.files.service';
import { binaryStl, cube } from './support/mesh.fixtures';
import { DELIVERY } from './support/order.fixtures';
import { cookieFor, createTestApp, TestContext } from './support/test.app';

interface OrderItem {
  itemKind: string;
  productName: string;
  unitPrice: number;
  selectedOptions: Array<{ groupName: string; label: string }>;
}

describe('Gripr Lab 3D modeling (e2e)', () => {
  let context: TestContext;
  const customer = cookieFor('customer');
  const otherCustomer = cookieFor('otherCustomer');
  const admin = cookieFor('admin');

  beforeAll(async () => {
    context = await createTestApp();
    const settings = await request(server())
      .get('/api/print-settings')
      .set('Cookie', admin)
      .expect(200);
    await request(server())
      .put('/api/print-settings')
      .set('Cookie', admin)
      .send({
        ...settings.body,
        bases: [{ code: 'round-25', name: 'Кругла 25 мм', price: 3000 }],
      })
      .expect(200);
  });

  afterAll(async () => {
    await context.close();
  });

  const server = () => context.app.getHttpServer();

  async function upload(
    url: string,
    fileName: string,
    cookie: string,
    complete: string,
  ): Promise<string> {
    const bytes = binaryStl(cube(10));
    const created = await request(server())
      .post(url)
      .set('Cookie', cookie)
      .send({ fileName, sizeBytes: bytes.length })
      .expect(201);
    const { file, storagePath } = created.body as {
      file: { id: string };
      storagePath: string;
    };
    context.storage.put(storagePath, bytes);
    await request(server())
      .post(complete.replace(':id', file.id))
      .set('Cookie', cookie)
      .expect(200);

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [row] = await context.db
        .select({ status: printFiles.status })
        .from(printFiles)
        .where(eq(printFiles.id, file.id));

      if (row.status !== 'analyzing') return file.id;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('The model was not measured in time');
  }

  const sourceFile = (fileName: string) =>
    upload(
      '/api/customers/me/print-files',
      fileName,
      customer,
      '/api/customers/me/print-files/:id/complete',
    );

  async function labRequest(labSpecification: object): Promise<string> {
    const created = await request(server())
      .post('/api/customers/me/custom-requests')
      .set('Cookie', customer)
      .send({
        store: 'lab',
        productType: 'miniature',
        description: 'Лицар з мечем і щитом на скелі',
        labSpecification,
      })
      .expect(201);
    return created.body.id as string;
  }

  const proposal = {
    title: 'Лицар на скелі',
    requiresModel: true,
    modelingHours: 4,
    productPrice: 0,
    productionPrepayment: 0,
    productionDaysMin: 5,
    productionDaysMax: 10,
  };

  async function accept(id: string): Promise<string> {
    const accepted = await request(server())
      .post(`/api/customers/me/custom-requests/${id}/accept`)
      .set('Cookie', customer)
      .send({ contactName: 'Олена', delivery: DELIVERY })
      .expect(200);
    return accepted.body.orderId as string;
  }

  it('validates Gripr Lab requests and proposals', async () => {
    const create = (body: object) =>
      request(server())
        .post('/api/customers/me/custom-requests')
        .set('Cookie', customer)
        .send({ description: 'Мініатюра дракона на підставці', ...body });

    await create({ store: 'lab', productType: 'miniature' }).expect(400);
    await create({
      store: 'lab',
      productType: 'ring',
      labSpecification: { deliverable: 'file' },
    }).expect(400);
    await create({
      productType: 'ring',
      labSpecification: { deliverable: 'file' },
    }).expect(400);
    await create({
      store: 'lab',
      productType: 'miniature',
      labSpecification: { deliverable: 'print', baseCode: 'square-40' },
    }).expect(400);

    const othersFile = await upload(
      '/api/customers/me/print-files',
      'others.stl',
      otherCustomer,
      '/api/customers/me/print-files/:id/complete',
    );
    await create({
      store: 'lab',
      productType: 'miniature',
      labSpecification: { deliverable: 'file', sourceFileId: othersFile },
    }).expect(400);

    const id = await labRequest({ deliverable: 'print' });
    const propose = (body: object) =>
      request(server())
        .post(`/api/custom-requests/${id}/proposals`)
        .set('Cookie', admin)
        .send({ ...proposal, ...body });

    await propose({ labSpecification: { deliverable: 'print' } }).expect(400);
    await propose({
      labSpecification: { deliverable: 'file' },
      productPrice: 10_000,
    }).expect(400);
    await propose({
      labSpecification: { deliverable: 'file' },
      requiresModel: false,
    }).expect(400);
    await propose({
      labSpecification: { deliverable: 'file' },
      modelingHours: undefined,
    }).expect(400);
    await propose({
      labSpecification: { deliverable: 'file' },
      specification: { productType: 'ring', metalMode: 'recommend' },
    }).expect(400);
  });

  it('designs a model, charges paid revisions, and delivers the file', async () => {
    const fileId = await sourceFile('knight.stl');
    const id = await labRequest({
      deliverable: 'file',
      heightMm: 32,
      sourceFileId: fileId,
      comments: 'Додайте плащ',
    });

    const created = await request(server())
      .get(`/api/customers/me/custom-requests/${id}`)
      .set('Cookie', customer)
      .expect(200);
    expect(created.body).toMatchObject({
      store: 'lab',
      productType: 'miniature',
      specification: null,
      labSpecification: {
        deliverable: 'file',
        heightMm: 32,
        resin: null,
        quantity: 1,
        sourceFile: { id: fileId, name: 'knight.stl' },
        comments: 'Додайте плащ',
      },
    });

    await request(server())
      .delete(`/api/customers/me/print-files/${fileId}`)
      .set('Cookie', customer)
      .expect(409);

    const listed = await request(server())
      .get('/api/custom-requests?store=lab')
      .set('Cookie', admin)
      .expect(200);
    expect(listed.body.items.map((item: { id: string }) => item.id)).toContain(
      id,
    );

    const quoted = await request(server())
      .post(`/api/custom-requests/${id}/proposals`)
      .set('Cookie', admin)
      .send({
        ...proposal,
        labSpecification: {
          deliverable: 'file',
          heightMm: 32,
          sourceFileId: fileId,
        },
      })
      .expect(200);
    expect(quoted.body.proposal).toMatchObject({
      specification: null,
      labSpecification: { deliverable: 'file', heightMm: 32 },
      modelingHours: 4,
      modelPrice: 217_000,
      productPrice: 0,
      totalPrice: 217_000,
      revisionTerms: {
        freeBig: 1,
        freeSmall: 2,
        bigPrice: 100_000,
        smallPrice: 25_000,
      },
    });

    const orderId = await accept(id);
    const orderUrl = `/api/orders/${orderId}`;
    const customerOrderUrl = `/api/customers/me/orders/${orderId}`;
    const order = await request(server())
      .get(orderUrl)
      .set('Cookie', admin)
      .expect(200);
    expect(order.body).toMatchObject({
      store: 'lab',
      status: 'awaiting_model_payment',
      total: 217_000,
      modelPaymentAmount: 217_000,
      productionPaymentAmount: 0,
      modeling: {
        deliverable: 'file',
        bigRevisions: 0,
        freeBigRevisionsLeft: 1,
        freeSmallRevisionsLeft: 2,
        pendingRevision: false,
        license: PERSONAL_USE_LICENSE,
      },
    });
    expect(
      (order.body.items as OrderItem[]).map((item) => [
        item.itemKind,
        item.productName,
        item.unitPrice,
      ]),
    ).toEqual([['model', '3D-модель: Лицар на скелі', 217_000]]);

    await request(server())
      .post(`${orderUrl}/payments`)
      .set('Cookie', admin)
      .send({ amount: 217_000 })
      .expect(201);
    const toReview = () =>
      request(server())
        .patch(`${orderUrl}/status`)
        .set('Cookie', admin)
        .send({ status: 'model_review' });
    const requestChanges = (comment: string) =>
      request(server())
        .post(`${customerOrderUrl}/model/request-changes`)
        .set('Cookie', customer)
        .send({ comment })
        .expect(200);
    const classify = (kind: string) =>
      request(server())
        .post(`${orderUrl}/model/revisions`)
        .set('Cookie', admin)
        .send({ kind });

    await classify('big').expect(409);
    await toReview().expect(200);
    await requestChanges('Змініть позу лицаря');
    await toReview().expect(409);
    await classify('medium').expect(400);
    const free = await classify('big').expect(200);
    expect(free.body).toMatchObject({
      status: 'modeling',
      total: 217_000,
      modeling: {
        bigRevisions: 1,
        freeBigRevisionsLeft: 0,
        pendingRevision: false,
      },
    });
    await classify('big').expect(409);

    await toReview().expect(200);
    await requestChanges('Ще раз змініть позу');
    const paid = await classify('big').expect(200);
    expect(paid.body).toMatchObject({
      status: 'awaiting_model_payment',
      total: 317_000,
      modelPaymentAmount: 317_000,
      nextPayment: { type: 'model_prepayment', amount: 100_000 },
      modeling: { bigRevisions: 2 },
    });
    expect((paid.body.items as OrderItem[]).at(-1)).toMatchObject({
      itemKind: 'model',
      productName: 'Велика правка моделі',
      unitPrice: 100_000,
    });

    const resumed = await request(server())
      .post(`${orderUrl}/payments`)
      .set('Cookie', admin)
      .send({ amount: 100_000 })
      .expect(201);
    expect(resumed.body.status).toBe('modeling');

    await request(server())
      .post(`/api/orders/${orderId}/files`)
      .set('Cookie', customer)
      .send({ fileName: 'knight-final.stl', sizeBytes: 100 })
      .expect(403);
    const deliveredId = await upload(
      `/api/orders/${orderId}/files`,
      'knight-final.stl',
      admin,
      '/api/print-files/:id/complete',
    );
    const staffFiles = await request(server())
      .get(`/api/orders/${orderId}/files`)
      .set('Cookie', admin)
      .expect(200);
    expect(staffFiles.body).toMatchObject([{ id: deliveredId, orderId }]);

    const customerFiles = await request(server())
      .get(`${customerOrderUrl}/files`)
      .set('Cookie', customer)
      .expect(200);
    expect(customerFiles.body).toMatchObject([
      { id: deliveredId, fileName: 'knight-final.stl' },
    ]);
    await request(server())
      .get(`${customerOrderUrl}/files`)
      .set('Cookie', otherCustomer)
      .expect(404);
    await request(server())
      .get(`${customerOrderUrl}/files/${deliveredId}`)
      .set('Cookie', customer)
      .expect(409);

    await toReview().expect(200);
    const approved = await request(server())
      .post(`${customerOrderUrl}/model/approve`)
      .set('Cookie', customer)
      .expect(200);
    expect(approved.body).toMatchObject({
      status: 'completed',
      modeling: { deliverable: 'file', bigRevisions: 2 },
    });

    const download = await request(server())
      .get(`${customerOrderUrl}/files/${deliveredId}`)
      .set('Cookie', customer)
      .expect(200);
    expect(download.body).toMatchObject({
      url: expect.any(String),
      license: PERSONAL_USE_LICENSE,
    });
  });

  it('splits a printed model into model and print items', async () => {
    const resins = await request(server())
      .get('/api/storefront/resins')
      .expect(200);
    const resin = resins.body[0] as { id: string; name: string };
    const id = await labRequest({ deliverable: 'print_and_file' });

    await request(server())
      .post(`/api/custom-requests/${id}/proposals`)
      .set('Cookie', admin)
      .send({
        ...proposal,
        modelingHours: undefined,
        modelPrice: 150_000,
        productPrice: 80_000,
        productionPrepayment: 40_000,
        labSpecification: {
          deliverable: 'print_and_file',
          heightMm: 75,
          resinId: resin.id,
          finish: 'sanded',
          painted: true,
          baseCode: 'round-25',
          quantity: 2,
        },
      })
      .expect(200);

    const orderId = await accept(id);
    const order = await request(server())
      .get(`/api/customers/me/orders/${orderId}`)
      .set('Cookie', customer)
      .expect(200);
    expect(order.body).toMatchObject({
      total: 230_000,
      modelPaymentAmount: 150_000,
      productionPaymentAmount: 40_000,
      modeling: { deliverable: 'print_and_file' },
    });
    const items = order.body.items as OrderItem[];
    expect(
      items.map((item) => [item.itemKind, item.productName, item.unitPrice]),
    ).toEqual([
      ['model', '3D-модель: Лицар на скелі', 150_000],
      ['print', 'Друк: Лицар на скелі', 80_000],
    ]);
    expect(
      items[1].selectedOptions.map((option) => [
        option.groupName,
        option.label,
      ]),
    ).toEqual([
      ['Розмір', '75 мм'],
      ['Смола', resin.name],
      ['Обробка друку', 'Відшліфовано'],
      ['Розфарбування', 'Так'],
      ['Підставка', 'Кругла 25 мм'],
      ['Кількість', '2 шт.'],
    ]);
  });

  it('keeps source files of open custom requests', async () => {
    const kept = await sourceFile('kept-source.stl');
    await labRequest({ deliverable: 'file', sourceFileId: kept });
    const released = await sourceFile('released-source.stl');
    const declinedId = await labRequest({
      deliverable: 'file',
      sourceFileId: released,
    });

    const old = new Date(Date.now() - 40 * 86_400_000);
    await context.db
      .update(customRequests)
      .set({ status: 'rejected', updatedAt: old })
      .where(eq(customRequests.id, declinedId));
    for (const fileId of [kept, released]) {
      await context.db
        .update(printFiles)
        .set({ createdAt: old })
        .where(eq(printFiles.id, fileId));
    }

    await context.app.get(PrintFilesService).cleanup();
    const ids = (
      await context.db.select({ id: printFiles.id }).from(printFiles)
    ).map((file) => file.id);
    expect(ids).toContain(kept);
    expect(ids).not.toContain(released);
  });
});
