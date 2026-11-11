import { eq } from 'drizzle-orm';
import request from 'supertest';
import {
  printFiles,
  printRequests,
} from '../src/integrations/database/database.schema';
import { PrintFilesService } from '../src/modules/prints/print.files.service';
import { PrintRequestsService } from '../src/modules/prints/print.requests.service';
import { binaryStl, cube } from './support/mesh.fixtures';
import { DELIVERY } from './support/order.fixtures';
import { cookieFor, createTestApp, TestContext } from './support/test.app';

const PRINTER = {
  code: 'saturn-4',
  name: 'Elegoo Saturn 4 Ultra',
  isDefault: true,
  buildXMm: 218,
  buildYMm: 123,
  buildZMm: 220,
  layerHeightMm: 0.05,
  secondsPerLayer: 3,
  bottomLayers: 4,
  bottomLayerSeconds: 25,
  fixedMinutes: 8,
  costCurrency: 'UAH',
  price: 1_500_000,
  lifetimeHours: 4000,
  lcdPrice: 300_000,
  lcdLifetimeHours: 2000,
  filmPrice: 20_000,
  layersPerFilm: 40000,
  electricityPerHour: 80,
  plateFillRate: 0.6,
  spacingMm: 4,
};

interface Item {
  id: string;
  fileName: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  priceError: string | null;
  sizeMm: { x: number; y: number; z: number } | null;
  resin: { id: string; name: string } | null;
  base: { code: string; name: string } | null;
}

interface PrintRequest {
  id: string;
  status: string;
  items: Item[];
  estimate: number | null;
  confirmedPrice: number | null;
  priceValidUntil: string | null;
  staffNote: string | null;
  orderId: string | null;
}

describe('Lab print requests (e2e)', () => {
  let context: TestContext;
  const customer = cookieFor('customer');
  const otherCustomer = cookieFor('otherCustomer');
  const admin = cookieFor('admin');

  beforeAll(async () => {
    context = await createTestApp();
    await request(server())
      .post('/api/printers')
      .set('Cookie', admin)
      .send(PRINTER)
      .expect(201);
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

  /** Uploads a model and waits until it is measured. */
  async function model(
    fileName: string,
    bytes: Buffer,
    cookie = customer,
  ): Promise<string> {
    const created = await request(server())
      .post('/api/customers/me/print-files')
      .set('Cookie', cookie)
      .send({ fileName, sizeBytes: bytes.length })
      .expect(201);
    const { file, storagePath } = created.body as {
      file: { id: string };
      storagePath: string;
    };
    context.storage.put(storagePath, bytes);
    await request(server())
      .post(`/api/customers/me/print-files/${file.id}/complete`)
      .set('Cookie', cookie)
      .expect(200);

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await request(server())
        .get(`/api/customers/me/print-files/${file.id}`)
        .set('Cookie', cookie)
        .expect(200);

      if (response.body.status !== 'analyzing') return file.id;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('The model was not measured in time');
  }

  const mine = (id: string) => `/api/customers/me/print-requests/${id}`;

  async function submitted(fileId: string, item: object = {}) {
    const created = await request(server())
      .post('/api/customers/me/print-requests')
      .set('Cookie', customer)
      .send({ rightsConfirmed: true, items: [{ fileId, ...item }] })
      .expect(201);
    const id = (created.body as PrintRequest).id;
    await request(server())
      .post(`${mine(id)}/submit`)
      .set('Cookie', customer)
      .expect(200);
    return id;
  }

  async function confirmed(fileId: string) {
    const id = await submitted(fileId);
    const response = await request(server())
      .post(`/api/print-requests/${id}/confirm`)
      .set('Cookie', admin)
      .expect(200);
    return response.body as PrintRequest;
  }

  it('lists the print choices without base prices', async () => {
    const options = await request(server())
      .get('/api/storefront/print-options')
      .expect(200);
    expect(options.body).toMatchObject({
      bases: [{ code: 'round-25', name: 'Кругла 25 мм' }],
      finishes: ['raw', 'supports_removed', 'sanded'],
      maxItems: 20,
      priceValidDays: 14,
    });
    expect(options.body.bases[0].price).toBeUndefined();
  });

  it('takes a customer model from a quote to a paid-for order', async () => {
    const fileId = await model('dragon.stl', binaryStl(cube(20)));
    const item = {
      fileId,
      heightMm: 40,
      painted: true,
      baseCode: 'round-25',
      quantity: 2,
    };

    const quote = await request(server())
      .post('/api/customers/me/print-requests/quote')
      .set('Cookie', customer)
      .send({ items: [item] })
      .expect(200);
    expect(quote.body.items[0]).toMatchObject({
      priceError: null,
      sizeMm: { x: 40, y: 40, z: 40 },
      fitsPrinter: true,
    });
    expect(quote.body.items[0].lineTotal).toBe(
      quote.body.items[0].unitPrice * 2,
    );
    expect(quote.body.estimate).toBe(quote.body.items[0].lineTotal);

    await request(server())
      .post('/api/customers/me/print-requests/quote')
      .set('Cookie', customer)
      .send({ items: [{ ...item, scaleFactor: 2 }] })
      .expect(400);
    await request(server())
      .post('/api/customers/me/print-requests/quote')
      .set('Cookie', customer)
      .send({ items: [{ ...item, baseCode: 'square-40' }] })
      .expect(400);
    const foreign = await model(
      'foreign.stl',
      binaryStl(cube(10)),
      otherCustomer,
    );
    await request(server())
      .post('/api/customers/me/print-requests/quote')
      .set('Cookie', customer)
      .send({ items: [{ ...item, fileId: foreign }] })
      .expect(400);

    const created = await request(server())
      .post('/api/customers/me/print-requests')
      .set('Cookie', customer)
      .send({ comment: 'Для настільної гри', items: [item] })
      .expect(201);
    const draft = created.body as PrintRequest;
    expect(draft).toMatchObject({
      status: 'draft',
      estimate: quote.body.estimate,
      items: [
        expect.objectContaining({
          fileName: 'dragon.stl',
          base: { code: 'round-25', name: 'Кругла 25 мм' },
          resin: expect.objectContaining({ name: expect.any(String) }),
        }),
      ],
    });
    const id = draft.id;

    await request(server())
      .post(`${mine(id)}/submit`)
      .set('Cookie', customer)
      .expect(400);
    await request(server())
      .patch(mine(id))
      .set('Cookie', customer)
      .send({ rightsConfirmed: true })
      .expect(200);
    await request(server())
      .delete(`/api/customers/me/print-files/${fileId}`)
      .set('Cookie', customer)
      .expect(409);
    await request(server())
      .get(mine(id))
      .set('Cookie', otherCustomer)
      .expect(404);
    await request(server())
      .get(`/api/print-requests/${id}`)
      .set('Cookie', customer)
      .expect(403);

    const sent = await request(server())
      .post(`${mine(id)}/submit`)
      .set('Cookie', customer)
      .expect(200);
    expect(sent.body.status).toBe('submitted');
    await request(server())
      .patch(mine(id))
      .set('Cookie', customer)
      .send({ comment: 'Ще одне' })
      .expect(409);

    const listed = await request(server())
      .get('/api/print-requests?status=submitted')
      .set('Cookie', admin)
      .expect(200);
    expect(listed.body.items.map((r: PrintRequest) => r.id)).toContain(id);

    const staffView = await request(server())
      .get(`/api/print-requests/${id}`)
      .set('Cookie', admin)
      .expect(200);
    expect(staffView.body.items[0]).toMatchObject({
      basePrice: 3000,
      calculation: expect.objectContaining({ fitsPrinter: true }),
    });

    const reviewed = await request(server())
      .patch(`/api/print-requests/${id}`)
      .set('Cookie', admin)
      .send({
        productionDaysMin: 3,
        productionDaysMax: 5,
        items: [
          {
            id: draft.items[0].id,
            paintingMultiplier: 3,
            overrides: { printHours: 6 },
          },
        ],
      })
      .expect(200);
    expect(reviewed.body.status).toBe('in_review');
    expect(reviewed.body.items[0].calculation.paintingMultiplier).toBe(3);
    expect(reviewed.body.items[0].unitPrice).toBeGreaterThan(
      draft.items[0].unitPrice!,
    );

    const confirmedRequest = await request(server())
      .post(`/api/print-requests/${id}/confirm`)
      .set('Cookie', admin)
      .expect(200);
    const price = confirmedRequest.body.confirmedPrice as number;
    expect(confirmedRequest.body).toMatchObject({
      status: 'confirmed',
      confirmedPrice: reviewed.body.estimate,
      productionDaysMin: 3,
      productionDaysMax: 5,
    });
    expect(confirmedRequest.body.priceValidUntil).not.toBeNull();

    const thread = await request(server())
      .post(`${mine(id)}/messages`)
      .set('Cookie', customer)
      .send({ body: 'Дякую, беру' })
      .expect(201);
    expect(thread.body).toEqual([
      expect.objectContaining({ body: 'Дякую, беру', thread: 'print_request' }),
    ]);
    const staffThread = await request(server())
      .get(`/api/print-requests/${id}/messages`)
      .set('Cookie', admin)
      .expect(200);
    expect(staffThread.body).toHaveLength(1);

    const product = await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send({
        slug: 'stone-golem',
        name: "Кам'яний голем",
        type: 'figurine',
        status: 'published',
        basePrice: 9_000,
      })
      .expect(201);
    await request(server())
      .post('/api/customers/me/cart/items')
      .set('Cookie', customer)
      .send({ productId: product.body.id })
      .expect(200);
    const inCart = await request(server())
      .post(`${mine(id)}/cart`)
      .set('Cookie', customer)
      .expect(200);
    expect(inCart.body.status).toBe('in_cart');

    const cart = await request(server())
      .get('/api/customers/me/cart?store=lab')
      .set('Cookie', customer)
      .expect(200);
    expect(cart.body).toMatchObject({
      total: 9_000 + price,
      subtotal: 9_000 + price,
      hasUnavailableItems: false,
      productionDaysMax: 5,
      prints: [
        expect.objectContaining({
          requestId: id,
          total: price,
          unavailableReason: null,
        }),
      ],
    });
    const griprCart = await request(server())
      .get('/api/customers/me/cart')
      .set('Cookie', customer)
      .expect(200);
    expect(griprCart.body.prints).toEqual([]);

    const checkout = await request(server())
      .post('/api/customers/me/orders')
      .set('Cookie', customer)
      .send({ store: 'lab', contactName: 'Олена', delivery: DELIVERY })
      .expect(201);
    expect(checkout.body.total).toBe(9_000 + price);
    expect(checkout.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemKind: 'product',
          productId: product.body.id,
        }),
        expect.objectContaining({
          itemKind: 'print',
          printRequestId: id,
          productId: null,
          productName: 'Друк: dragon.stl',
          quantity: 2,
          lineTotal: price,
          selectedOptions: expect.arrayContaining([
            expect.objectContaining({ kind: 'scale', label: '40 мм' }),
            expect.objectContaining({ kind: 'base', label: 'Кругла 25 мм' }),
            expect.objectContaining({ kind: 'painting' }),
          ]),
        }),
      ]),
    );

    const ordered = await request(server())
      .get(mine(id))
      .set('Cookie', customer)
      .expect(200);
    expect(ordered.body).toMatchObject({
      status: 'ordered',
      orderId: checkout.body.id,
    });
    const emptied = await request(server())
      .get('/api/customers/me/cart?store=lab')
      .set('Cookie', customer)
      .expect(200);
    expect(emptied.body).toMatchObject({ items: [], prints: [], total: 0 });
    await request(server())
      .post(`${mine(id)}/cancel`)
      .set('Cookie', customer)
      .expect(409);

    await request(server())
      .post(`/api/customers/me/orders/${checkout.body.id}/cancel`)
      .set('Cookie', customer)
      .expect(200);
    const cancelled = await request(server())
      .get(mine(id))
      .set('Cookie', customer)
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    await request(server())
      .delete(`/api/customers/me/print-files/${fileId}`)
      .set('Cookie', customer)
      .expect(204);
  });

  it('returns requests for changes and rejects them', async () => {
    const fileId = await model('knight.stl', binaryStl(cube(15)));
    const id = await submitted(fileId);

    const returned = await request(server())
      .post(`/api/print-requests/${id}/request-changes`)
      .set('Cookie', admin)
      .send({ note: 'Зменшіть до 30 мм' })
      .expect(200);
    expect(returned.body).toMatchObject({
      status: 'changes_requested',
      staffNote: 'Зменшіть до 30 мм',
    });
    const thread = await request(server())
      .get(`${mine(id)}/messages`)
      .set('Cookie', customer)
      .expect(200);
    expect(thread.body).toEqual([
      expect.objectContaining({
        authorRole: 'staff',
        body: 'Зменшіть до 30 мм',
      }),
    ]);

    const edited = await request(server())
      .patch(mine(id))
      .set('Cookie', customer)
      .send({ items: [{ fileId, heightMm: 30, quantity: 3 }] })
      .expect(200);
    expect(edited.body.items[0]).toMatchObject({ quantity: 3 });
    const resent = await request(server())
      .post(`${mine(id)}/submit`)
      .set('Cookie', customer)
      .expect(200);
    expect(resent.body).toMatchObject({ status: 'submitted', staffNote: null });

    const rejected = await request(server())
      .post(`/api/print-requests/${id}/reject`)
      .set('Cookie', admin)
      .send({ note: 'Модель не друкується' })
      .expect(200);
    expect(rejected.body.status).toBe('rejected');
    await request(server())
      .post(`${mine(id)}/cancel`)
      .set('Cookie', customer)
      .expect(409);
    await request(server())
      .post(`/api/print-requests/${id}/confirm`)
      .set('Cookie', admin)
      .expect(409);
  });

  it('confirms models measured by staff once they are priced', async () => {
    const created = await request(server())
      .post('/api/customers/me/print-files')
      .set('Cookie', customer)
      .send({ fileName: 'bracket.step', sizeBytes: 13 })
      .expect(201);
    const { file, storagePath } = created.body as {
      file: { id: string };
      storagePath: string;
    };
    context.storage.put(storagePath, Buffer.from('ISO-10303-21;'));
    await request(server())
      .post(`/api/customers/me/print-files/${file.id}/complete`)
      .set('Cookie', customer)
      .expect(200);

    const id = await submitted(file.id);
    const pending = await request(server())
      .get(mine(id))
      .set('Cookie', customer)
      .expect(200);
    expect(pending.body).toMatchObject({
      estimate: null,
      items: [
        expect.objectContaining({
          unitPrice: null,
          priceError: 'Price after review: staff measure this model',
        }),
      ],
    });
    await request(server())
      .post(`/api/print-requests/${id}/confirm`)
      .set('Cookie', admin)
      .expect(409);

    await request(server())
      .patch(`/api/print-files/${file.id}/measurements`)
      .set('Cookie', admin)
      .send({ volumeMl: 12.5, sizeMm: { x: 30, y: 20, z: 40 } })
      .expect(200);
    const priced = await request(server())
      .post(`/api/print-requests/${id}/confirm`)
      .set('Cookie', admin)
      .expect(200);
    expect(priced.body.status).toBe('confirmed');
    expect(priced.body.confirmedPrice).toBeGreaterThan(0);
  });

  it('sends expired prices back to review', async () => {
    const fileId = await model('wizard.stl', binaryStl(cube(12)));
    const ageConfirmation = (id: string) =>
      context.db
        .update(printRequests)
        .set({ confirmedAt: new Date(Date.now() - 15 * 86_400_000) })
        .where(eq(printRequests.id, id));

    const late = await confirmed(fileId);
    await ageConfirmation(late.id);
    await request(server())
      .post(`${mine(late.id)}/cart`)
      .set('Cookie', customer)
      .expect(409);
    const reviewed = await request(server())
      .get(mine(late.id))
      .set('Cookie', customer)
      .expect(200);
    expect(reviewed.body).toMatchObject({
      status: 'in_review',
      confirmedPrice: null,
      priceValidUntil: null,
    });

    const carted = await confirmed(fileId);
    await request(server())
      .post(`${mine(carted.id)}/cart`)
      .set('Cookie', customer)
      .expect(200);
    await ageConfirmation(carted.id);
    const cart = await request(server())
      .get('/api/customers/me/cart?store=lab')
      .set('Cookie', customer)
      .expect(200);
    expect(cart.body).toMatchObject({
      total: 0,
      hasUnavailableItems: true,
      prints: [
        expect.objectContaining({
          requestId: carted.id,
          unavailableReason: expect.any(String),
        }),
      ],
    });
    await request(server())
      .post('/api/customers/me/orders')
      .set('Cookie', customer)
      .send({ store: 'lab', contactName: 'Олена', delivery: DELIVERY })
      .expect(409);

    expect(
      await context.app.get(PrintRequestsService).expireConfirmations(),
    ).toBe(1);
    const expired = await request(server())
      .get(mine(carted.id))
      .set('Cookie', customer)
      .expect(200);
    expect(expired.body.status).toBe('in_review');
  });

  it('keeps model files while a request needs them', async () => {
    const reviewedFile = await model('kept.stl', binaryStl(cube(10)));
    await submitted(reviewedFile);
    const closedFile = await model('closed.stl', binaryStl(cube(10)));
    const draft = await request(server())
      .post('/api/customers/me/print-requests')
      .set('Cookie', customer)
      .send({ items: [{ fileId: closedFile }] })
      .expect(201);
    const draftId = (draft.body as PrintRequest).id;
    await request(server())
      .post(`${mine(draftId)}/cancel`)
      .set('Cookie', customer)
      .expect(200);

    const old = new Date(Date.now() - 40 * 86_400_000);
    await context.db
      .update(printFiles)
      .set({ createdAt: old })
      .where(eq(printFiles.id, reviewedFile));
    await context.db
      .update(printFiles)
      .set({ createdAt: old })
      .where(eq(printFiles.id, closedFile));
    await context.db
      .update(printRequests)
      .set({ updatedAt: old })
      .where(eq(printRequests.id, draftId));

    await context.app.get(PrintFilesService).cleanup();
    const remaining = await context.db
      .select({ id: printFiles.id })
      .from(printFiles);
    const ids = remaining.map((file) => file.id);
    expect(ids).toContain(reviewedFile);
    expect(ids).not.toContain(closedFile);
  });
});
