import { eq } from 'drizzle-orm';
import request from 'supertest';
import { printFiles } from '../src/integrations/database/database.schema';
import { PrintFilesService } from '../src/modules/prints/print.files.service';
import { binaryStl, cube, zip } from './support/mesh.fixtures';
import {
  cookieFor,
  createTestApp,
  TestContext,
  USERS,
} from './support/test.app';

interface Upload {
  file: { id: string; status: string };
  uploadUrl: string;
  uploadToken: string;
  storagePath: string;
}

interface PrintFile {
  id: string;
  status: string;
  error: string | null;
  volumeMl: number | null;
  sizeMm: { x: number; y: number; z: number } | null;
  triangles: number | null;
  isWatertight: boolean | null;
  warnings: string[];
}

describe('Lab model files (e2e)', () => {
  let context: TestContext;
  const customer = cookieFor('customer');
  const otherCustomer = cookieFor('otherCustomer');
  const admin = cookieFor('admin');

  beforeAll(async () => {
    context = await createTestApp();
  });

  afterAll(async () => {
    await context.close();
  });

  const server = () => context.app.getHttpServer();

  async function upload(
    fileName: string,
    bytes: Buffer,
    options: { cookie?: string; productId?: string } = {},
  ): Promise<Upload> {
    const created = await request(server())
      .post(
        options.productId
          ? '/api/print-files'
          : '/api/customers/me/print-files',
      )
      .set('Cookie', options.productId ? admin : (options.cookie ?? customer))
      .send({
        fileName,
        sizeBytes: bytes.length,
        ...(options.productId ? { productId: options.productId } : {}),
      })
      .expect(201);
    const body = created.body as Upload;
    context.storage.put(body.storagePath, bytes);
    return body;
  }

  async function settled(path: string, cookie = customer): Promise<PrintFile> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await request(server())
        .get(path)
        .set('Cookie', cookie)
        .expect(200);
      const file = response.body as PrintFile;

      if (file.status !== 'analyzing') return file;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('The file was not measured in time');
  }

  it('validates the file before handing out an upload URL', async () => {
    await request(server())
      .post('/api/customers/me/print-files')
      .set('Cookie', customer)
      .send({ fileName: 'photo.png', sizeBytes: 100 })
      .expect(400);
    await request(server())
      .post('/api/customers/me/print-files')
      .set('Cookie', customer)
      .send({ fileName: 'huge.stl', sizeBytes: 50 * 1024 * 1024 + 1 })
      .expect(400);
    await request(server())
      .post('/api/customers/me/print-files')
      .send({ fileName: 'dragon.stl', sizeBytes: 100 })
      .expect(401);
  });

  it('measures a customer upload in the background', async () => {
    const created = await request(server())
      .post('/api/customers/me/print-files')
      .set('Cookie', customer)
      .send({ fileName: 'Dragon.STL', sizeBytes: 684 })
      .expect(201);
    const { file, storagePath, uploadUrl } = created.body as Upload;
    expect(file).toMatchObject({ status: 'uploading' });
    expect(storagePath).toBe(`customers/${USERS.customer.id}/${file.id}.stl`);
    expect(uploadUrl).toContain(storagePath);

    await request(server())
      .post(`/api/customers/me/print-files/${file.id}/complete`)
      .set('Cookie', customer)
      .expect(409);

    context.storage.put(storagePath, binaryStl(cube(10)));
    const completed = await request(server())
      .post(`/api/customers/me/print-files/${file.id}/complete`)
      .set('Cookie', customer)
      .expect(200);
    expect(completed.body.status).toBe('analyzing');

    const measured = await settled(`/api/customers/me/print-files/${file.id}`);
    expect(measured).toMatchObject({
      status: 'analyzed',
      error: null,
      sizeMm: { x: 10, y: 10, z: 10 },
      triangles: 12,
      isWatertight: true,
      warnings: [],
    });
    expect(measured.volumeMl).toBeCloseTo(1, 6);

    await request(server())
      .post(`/api/customers/me/print-files/${file.id}/complete`)
      .set('Cookie', customer)
      .expect(409);
    await request(server())
      .get(`/api/customers/me/print-files/${file.id}`)
      .set('Cookie', otherCustomer)
      .expect(404);

    await request(server())
      .delete(`/api/customers/me/print-files/${file.id}`)
      .set('Cookie', customer)
      .expect(204);
    expect(context.storage.objects.has(storagePath)).toBe(false);
    await request(server())
      .get(`/api/customers/me/print-files/${file.id}`)
      .set('Cookie', customer)
      .expect(404);
  });

  it('reports files it cannot measure and models too big for the printer', async () => {
    const broken = await upload(
      'broken.zip',
      zip([['notes.txt', Buffer.from('hi')]]),
    );
    await request(server())
      .post(`/api/customers/me/print-files/${broken.file.id}/complete`)
      .set('Cookie', customer)
      .expect(200);
    expect(
      await settled(`/api/customers/me/print-files/${broken.file.id}`),
    ).toMatchObject({
      status: 'failed',
      error: 'The archive has no STL, OBJ, or 3MF files',
    });

    const tall = await upload('tower.stl', binaryStl(cube(300)));
    await request(server())
      .post(`/api/customers/me/print-files/${tall.file.id}/complete`)
      .set('Cookie', customer)
      .expect(200);
    expect(
      (await settled(`/api/customers/me/print-files/${tall.file.id}`)).warnings,
    ).toEqual(['exceeds_build_volume']);
  });

  it('rejects stored files over the size limit', async () => {
    const liar = await upload('liar.stl', binaryStl(cube(10)));
    context.storage.put(
      liar.storagePath,
      binaryStl(cube(10)),
      50 * 1024 * 1024 + 1,
    );
    const completed = await request(server())
      .post(`/api/customers/me/print-files/${liar.file.id}/complete`)
      .set('Cookie', customer)
      .expect(200);
    expect(completed.body).toMatchObject({
      status: 'failed',
      error: 'The file is larger than 50 MB',
    });
    expect(context.storage.objects.has(liar.storagePath)).toBe(false);
  });

  it('accepts STEP files for staff to measure', async () => {
    const step = await upload('bracket.step', Buffer.from('ISO-10303-21;'));
    const completed = await request(server())
      .post(`/api/customers/me/print-files/${step.file.id}/complete`)
      .set('Cookie', customer)
      .expect(200);
    expect(completed.body).toMatchObject({ status: 'manual', volumeMl: null });

    await request(server())
      .patch(`/api/print-files/${step.file.id}/measurements`)
      .set('Cookie', customer)
      .send({ volumeMl: 12.5, sizeMm: { x: 30, y: 20, z: 40 } })
      .expect(403);
    const measured = await request(server())
      .patch(`/api/print-files/${step.file.id}/measurements`)
      .set('Cookie', admin)
      .send({ volumeMl: 12.5, sizeMm: { x: 30, y: 20, z: 40 } })
      .expect(200);
    expect(measured.body).toMatchObject({
      status: 'manual',
      volumeMl: 12.5,
      sizeMm: { x: 30, y: 20, z: 40 },
      customerId: USERS.customer.id,
      productId: null,
    });

    const download = await request(server())
      .get(`/api/print-files/${step.file.id}/download`)
      .set('Cookie', admin)
      .expect(200);
    expect(download.body.url).toContain(step.storagePath);
  });

  it('takes a Lab product print size from its staff model', async () => {
    const ring = await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send({ slug: 'plain-ring', name: 'Ring', type: 'ring', basePrice: 1000 })
      .expect(201);
    await request(server())
      .post('/api/print-files')
      .set('Cookie', admin)
      .send({ productId: ring.body.id, fileName: 'ring.stl', sizeBytes: 684 })
      .expect(400);

    const product = await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send({
        slug: 'cube-miniature',
        name: 'Куб',
        type: 'miniature',
        basePrice: 0,
        print: { mode: 'auto', volumeMl: 5, sizeMm: { x: 20, y: 20, z: 20 } },
      })
      .expect(201);
    const productId = product.body.id as string;
    const model = await upload('cube.stl', binaryStl(cube(20)), { productId });
    expect(model.storagePath).toBe(
      `products/${productId}/${model.file.id}.stl`,
    );
    await request(server())
      .post(`/api/print-files/${model.file.id}/complete`)
      .set('Cookie', admin)
      .expect(200);
    expect(
      await settled(`/api/print-files/${model.file.id}`, admin),
    ).toMatchObject({ status: 'analyzed', sizeMm: { x: 20, y: 20, z: 20 } });

    const listed = await request(server())
      .get(`/api/print-files?productId=${productId}`)
      .set('Cookie', admin)
      .expect(200);
    expect(listed.body.map((file: { id: string }) => file.id)).toEqual([
      model.file.id,
    ]);

    const updated = await request(server())
      .patch(`/api/products/${productId}`)
      .set('Cookie', admin)
      .send({ print: { mode: 'auto', printFileId: model.file.id } })
      .expect(200);
    expect(updated.body.print).toMatchObject({
      printFileId: model.file.id,
      sizeMm: { x: 20, y: 20, z: 20 },
    });
    expect(updated.body.print.volumeMl).toBeCloseTo(8, 6);

    await request(server())
      .post('/api/products')
      .set('Cookie', admin)
      .send({
        slug: 'cube-copy',
        name: 'Куб 2',
        type: 'miniature',
        basePrice: 0,
        print: { mode: 'auto', printFileId: model.file.id },
      })
      .expect(400);

    await request(server())
      .delete(`/api/print-files/${model.file.id}`)
      .set('Cookie', admin)
      .expect(409);
  });

  it('cleans up abandoned uploads, old customer files, and orphans', async () => {
    const abandoned = await upload('abandoned.stl', binaryStl(cube(10)));
    const kept = await upload('kept.stl', binaryStl(cube(10)), {
      cookie: otherCustomer,
    });
    await context.db
      .update(printFiles)
      .set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(printFiles.id, abandoned.file.id));

    const removed = await context.app.get(PrintFilesService).cleanup();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(context.storage.objects.has(abandoned.storagePath)).toBe(false);
    expect(context.storage.objects.has(kept.storagePath)).toBe(true);

    const [orphan] = await context.db
      .update(printFiles)
      .set({ customerId: null })
      .where(eq(printFiles.id, kept.file.id))
      .returning();
    expect(orphan.customerId).toBeNull();
    await context.app.get(PrintFilesService).cleanup();
    expect(context.storage.objects.has(kept.storagePath)).toBe(false);
  });

  it('answers 503 while uploads are not set up', async () => {
    context.storage.configured = false;

    try {
      await request(server())
        .post('/api/customers/me/print-files')
        .set('Cookie', customer)
        .send({ fileName: 'dragon.stl', sizeBytes: 684 })
        .expect(503);
    } finally {
      context.storage.configured = true;
    }
  });
});
