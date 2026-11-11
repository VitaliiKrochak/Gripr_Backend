import request from 'supertest';
import { CloudinaryService } from '../src/integrations/cloudinary/cloudinary.service';
import {
  SketchfabService,
  type SketchfabModel,
} from '../src/integrations/sketchfab/sketchfab.service';
import { ThingiverseService } from '../src/integrations/thingiverse/thingiverse.service';
import {
  DesignImportService,
  IMPORT_QUERIES,
} from '../src/modules/designs/design.import.service';
import { CatalogFixture, createCatalog } from './support/catalog.fixtures';
import { cookieFor, createTestApp, TestContext } from './support/test.app';

function model(
  sourceId: string,
  overrides: Partial<SketchfabModel> = {},
): SketchfabModel {
  return {
    sourceId,
    title: 'Dragon Ring',
    description: 'Printable ring for casting',
    tags: ['ring', 'jewelry', 'silver'],
    likes: 120,
    views: 4000,
    publishedAt: new Date('2025-01-01T00:00:00Z'),
    isDownloadable: true,
    isAgeRestricted: false,
    licenseLabel: 'CC Attribution',
    author: 'Maker',
    authorUrl: 'https://sketchfab.com/maker',
    previewUrl: `https://media.sketchfab.com/${sourceId}/preview.jpg`,
    embedUrl: `https://sketchfab.com/models/${sourceId}/embed`,
    sourceUrl: `https://sketchfab.com/3d-models/${sourceId}`,
    ...overrides,
  };
}

const MODELS: SketchfabModel[] = [
  model('dragon0001'),
  model('pikachu001', {
    title: 'Pikachu pendant',
    tags: ['pendant', 'jewelry', 'pokemon'],
    licenseLabel: 'CC0 Public Domain',
  }),
  model('chair00001', {
    title: 'Chair',
    tags: ['furniture'],
    description: null,
  }),
  model('noncomm001', { licenseLabel: 'CC Attribution-NonCommercial' }),
];

const LAB_MODELS: SketchfabModel[] = [
  model('miniature1', {
    title: 'Dragon miniature',
    description: 'Presupported resin miniature',
    tags: ['miniature', '28mm', 'tabletop'],
  }),
];

const UID = 'a'.repeat(32);

const THING = model('4567', {
  title: 'Roman bust',
  description: 'Printable marble bust',
  tags: ['bust', 'printable'],
  licenseLabel: 'Creative Commons - Attribution - No Derivatives',
  author: 'Sculptor',
  authorUrl: 'https://www.thingiverse.com/sculptor',
  previewUrl: 'https://cdn.thingiverse.com/4567/large.jpg',
  embedUrl: null,
  sourceUrl: 'https://www.thingiverse.com/thing:4567',
});

const PRINTABLES_PAGE = `<html><head>
<meta property="og:title" content="Dwarf warrior &amp; axe">
<meta property="og:image" content="https://media.printables.com/dwarf.jpg">
<meta name="author" content="Forge">
</head></html>`;

describe('Open-license designs (e2e)', () => {
  let context: TestContext;
  let catalog: CatalogFixture;
  const admin = cookieFor('admin');
  const sketchfab = {
    searchModels: jest.fn(({ q }: { q: string }) =>
      Promise.resolve({
        models: IMPORT_QUERIES.lab.includes(q) ? LAB_MODELS : MODELS,
        cursor: null,
      }),
    ),
    getModel: jest.fn((uid: string) =>
      Promise.resolve(
        model(uid, {
          title: 'Knight bust',
          description: null,
          tags: ['bust'],
        }),
      ),
    ),
  };
  const thingiverse = {
    isConfigured: () => true,
    search: jest.fn(() => Promise.resolve([{ id: '4567', likes: 10 }])),
    getThing: jest.fn(() => Promise.resolve(THING)),
  };
  const cloudinary = {
    folder: (name: string) => `jewelry/${name}`,
    uploadFromUrl: jest.fn((url: string, folder: string) =>
      Promise.resolve({
        publicId: `${folder}/copied`,
        url: `https://res.cloudinary.com/demo-cloud/image/upload/${folder}/copied.jpg`,
      }),
    ),
  };

  const server = () => context.app.getHttpServer();

  async function runImport(): Promise<void> {
    await request(server())
      .post('/api/design-candidates/import')
      .set('Cookie', admin)
      .expect(202);

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const status = await request(server())
        .get('/api/design-candidates/import/status')
        .set('Cookie', admin)
        .expect(200);

      if (!status.body.running) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error('Import did not finish');
  }

  async function candidateId(sourceTitle: string, query = ''): Promise<string> {
    const response = await request(server())
      .get(`/api/design-candidates${query}`)
      .set('Cookie', admin)
      .expect(200);

    return (response.body.items as Array<{ id: string; title: string }>).find(
      (item) => item.title === sourceTitle,
    )!.id;
  }

  beforeAll(async () => {
    context = await createTestApp([
      [SketchfabService, sketchfab],
      [ThingiverseService, thingiverse],
      [CloudinaryService, cloudinary],
    ]);
    const importer = context.app.get(DesignImportService);
    importer.requestDelayMs = 0;
    importer.thingiverseDelayMs = 0;
    catalog = await createCatalog(server());
  });

  afterAll(async () => {
    await context.close();
  });

  it('is available to administrators only', async () => {
    await request(server()).get('/api/design-candidates').expect(401);
    await request(server())
      .get('/api/design-candidates')
      .set('Cookie', cookieFor('customer'))
      .expect(403);
    await request(server())
      .post('/api/design-candidates/import')
      .set('Cookie', cookieFor('customer'))
      .expect(403);
  });

  it('imports licensed models of both stores and reports skipped models', async () => {
    await runImport();

    const status = await request(server())
      .get('/api/design-candidates/import/status')
      .set('Cookie', admin)
      .expect(200);

    expect(status.body).toMatchObject({ thingiverseEnabled: true });
    expect(status.body.lastRun).toMatchObject({
      status: 'completed',
      created: 4,
      skipped: { license: 1, irrelevant: 1 },
      sources: {
        sketchfab: { failedRequests: 0 },
        thingiverse: { fetched: 1, failedRequests: 0 },
      },
    });
    expect(thingiverse.getThing).toHaveBeenCalledTimes(1);
  });

  it('lists Gripr Lab candidates separately with their license terms', async () => {
    const queue = await request(server())
      .get('/api/design-candidates?store=lab')
      .set('Cookie', admin)
      .expect(200);

    expect(queue.body.total).toBe(2);
    expect(queue.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Dragon miniature',
          store: 'lab',
          source: 'sketchfab',
          suggestedType: 'miniature',
          ipRisk: 'low',
        }),
        expect.objectContaining({
          title: 'Roman bust',
          store: 'lab',
          source: 'thingiverse',
          license: 'cc_by_nd',
          suggestedType: 'bust',
          ipRisk: 'review',
        }),
      ]),
    );

    const bust = await request(server())
      .get(
        `/api/design-candidates/${await candidateId('Roman bust', '?store=lab')}`,
      )
      .set('Cookie', admin)
      .expect(200);

    expect(bust.body).toMatchObject({
      ipMatches: ['license: no derivatives'],
      attributionRequired: true,
      shareAlike: false,
      derivativesAllowed: false,
    });
  });

  describe('import by URL', () => {
    const importUrl = (body: object) =>
      request(server())
        .post('/api/design-candidates/import-url')
        .set('Cookie', admin)
        .send(body);

    afterEach(() => jest.restoreAllMocks());

    it('is available to administrators only', async () => {
      await request(server())
        .post('/api/design-candidates/import-url')
        .set('Cookie', cookieFor('customer'))
        .send({ url: `https://sketchfab.com/3d-models/${UID}` })
        .expect(403);
    });

    it('rejects links of other sites', async () => {
      await importUrl({ url: 'https://example.com/model/1' }).expect(400);
    });

    it('reads Sketchfab models from the API without the relevance threshold', async () => {
      const response = await importUrl({
        url: `https://sketchfab.com/3d-models/knight-bust-${UID}`,
        store: 'lab',
      }).expect(200);

      expect(sketchfab.getModel).toHaveBeenCalledWith(UID);
      expect(response.body).toMatchObject({
        store: 'lab',
        source: 'sketchfab',
        sourceId: UID,
        title: 'Knight bust',
        license: 'cc_by',
        status: 'candidate',
      });

      const again = await importUrl({
        url: `https://sketchfab.com/3d-models/${UID}`,
        store: 'lab',
      }).expect(200);
      expect(again.body.id).toBe(response.body.id);
    });

    it('answers 502 when the source cannot be read', async () => {
      sketchfab.getModel.mockRejectedValueOnce(new Error('down'));

      await importUrl({
        url: `https://sketchfab.com/3d-models/${'b'.repeat(32)}`,
      }).expect(502);
    });

    it('needs a license the store accepts for page sources', async () => {
      const url = 'https://www.printables.com/model/12345-dwarf-warrior';

      await importUrl({ url, store: 'lab' }).expect(400);
      await importUrl({ url, store: 'lab', license: 'cc_by_nc' }).expect(400);
      await importUrl({ url, license: 'cc_by_sa' }).expect(400);
    });

    it('reads Printables pages with the license chosen by staff', async () => {
      const fetchPage = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(PRINTABLES_PAGE, { status: 200 }));

      const response = await importUrl({
        url: 'https://www.printables.com/en/model/12345-dwarf-warrior',
        store: 'lab',
        license: 'cc_by_sa',
      }).expect(200);

      expect(fetchPage).toHaveBeenCalledWith(
        'https://www.printables.com/en/model/12345-dwarf-warrior',
        expect.anything(),
      );
      expect(response.body).toMatchObject({
        store: 'lab',
        source: 'printables',
        sourceId: '12345',
        title: 'Dwarf warrior & axe',
        authorName: 'Forge',
        previewUrl: 'https://media.printables.com/dwarf.jpg',
        license: 'cc_by_sa',
        shareAlike: true,
        derivativesAllowed: true,
      });
    });

    it('asks for the title and author when the page cannot be read', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response('', { status: 403 }));
      const url =
        'https://www.myminifactory.com/object/3d-print-orc-chief-98765';

      await importUrl({ url, store: 'lab', license: 'cc0' }).expect(400);

      const response = await importUrl({
        url,
        store: 'lab',
        license: 'cc0',
        title: 'Orc chief',
        authorName: 'Tusk',
      }).expect(200);

      expect(response.body).toMatchObject({
        source: 'myminifactory',
        sourceId: '98765',
        title: 'Orc chief',
        authorName: 'Tusk',
        license: 'cc0',
      });
    });
  });

  it('hides blocked IP risks unless they are requested', async () => {
    const queue = await request(server())
      .get('/api/design-candidates')
      .set('Cookie', admin)
      .expect(200);

    expect(queue.body.total).toBe(1);
    expect(queue.body.items[0]).toMatchObject({
      title: 'Dragon Ring',
      license: 'cc_by',
      suggestedType: 'ring',
      ipRisk: 'low',
      status: 'candidate',
    });

    const blocked = await request(server())
      .get('/api/design-candidates?ipRisk=blocked')
      .set('Cookie', admin)
      .expect(200);

    expect(blocked.body.items).toHaveLength(1);
    expect(blocked.body.items[0]).toMatchObject({
      title: 'Pikachu pendant',
      license: 'cc0',
    });

    const detail = await request(server())
      .get(`/api/design-candidates/${blocked.body.items[0].id}`)
      .set('Cookie', admin)
      .expect(200);

    expect(detail.body).toMatchObject({
      ipMatches: expect.arrayContaining(['pikachu']),
      licenseName: 'CC0 1.0 Public Domain Dedication',
      attributionRequired: false,
    });
  });

  it('requires an IP acknowledgement for blocked designs', async () => {
    const id = await candidateId('Pikachu pendant', '?ipRisk=blocked');

    await request(server())
      .post(`/api/design-candidates/${id}/approve`)
      .set('Cookie', admin)
      .send({ type: 'pendant' })
      .expect(409);
  });

  it('rejects and restores candidates', async () => {
    const id = await candidateId('Pikachu pendant', '?ipRisk=blocked');

    await request(server())
      .post(`/api/design-candidates/${id}/reject`)
      .set('Cookie', admin)
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('rejected'));
    await request(server())
      .post(`/api/design-candidates/${id}/reject`)
      .set('Cookie', admin)
      .expect(409);
    await request(server())
      .post(`/api/design-candidates/${id}/restore`)
      .set('Cookie', admin)
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('candidate'));
  });

  describe('approved design', () => {
    let productId: string;
    let slug: string;

    beforeAll(async () => {
      const id = await candidateId('Dragon Ring');
      const response = await request(server())
        .post(`/api/design-candidates/${id}/approve`)
        .set('Cookie', admin)
        .send({ type: 'ring' })
        .expect(201);

      productId = response.body.id;
      slug = response.body.slug;
    });

    it('creates a draft product with the preview photo and credit', async () => {
      const product = await request(server())
        .get(`/api/products/${productId}`)
        .set('Cookie', admin)
        .expect(200);

      expect(product.body).toMatchObject({
        slug: 'dragon-ring-dragon',
        name: 'Dragon Ring',
        type: 'ring',
        status: 'draft',
        basePrice: 0,
        images: [{ publicId: 'jewelry/products/copied', alt: 'Dragon Ring' }],
        designCredit: {
          title: 'Dragon Ring',
          author: 'Maker',
          sourceName: 'Sketchfab',
          license: 'cc_by',
          attributionRequired: true,
        },
      });
      expect(cloudinary.uploadFromUrl).toHaveBeenCalledWith(
        'https://media.sketchfab.com/dragon0001/preview.jpg',
        'jewelry/products',
      );
    });

    it('cannot be approved twice', async () => {
      const id = await candidateId('Dragon Ring', '?status=approved');

      await request(server())
        .post(`/api/design-candidates/${id}/approve`)
        .set('Cookie', admin)
        .send({ type: 'ring' })
        .expect(409);
    });

    it('keeps the review state when the import runs again', async () => {
      await runImport();

      const approved = await request(server())
        .get('/api/design-candidates?status=approved')
        .set('Cookie', admin)
        .expect(200);

      expect(approved.body.items).toEqual([
        expect.objectContaining({ title: 'Dragon Ring', productId }),
      ]);
    });

    it('cannot be published without a price', async () => {
      await request(server())
        .patch(`/api/products/${productId}`)
        .set('Cookie', admin)
        .send({ status: 'published' })
        .expect(409);

      await request(server())
        .patch(`/api/products/${productId}`)
        .set('Cookie', admin)
        .send({ status: 'published', basePrice: 100 })
        .expect(200);
    });

    it('shows the public credit on the storefront product page', async () => {
      const response = await request(server())
        .get(`/api/storefront/products/${slug}`)
        .expect(200);

      expect(response.body.designCredit).toEqual({
        title: 'Dragon Ring',
        author: 'Maker',
        authorUrl: 'https://sketchfab.com/maker',
        sourceName: 'Sketchfab',
        sourceUrl: 'https://sketchfab.com/3d-models/dragon0001',
        license: 'cc_by',
        licenseName: 'Creative Commons Attribution 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        attributionRequired: true,
      });

      const own = await request(server())
        .get('/api/storefront/products/aurora-ring')
        .expect(200);
      expect(own.body.designCredit).toBeNull();
    });

    it.each(['featured', 'newest', 'price_asc', 'price_desc'])(
      'lists open models after own products (%s)',
      async (sort) => {
        const response = await request(server())
          .get(`/api/storefront/products?sort=${sort}`)
          .expect(200);
        const slugs = (response.body.items as Array<{ slug: string }>).map(
          (item) => item.slug,
        );

        expect(slugs).toHaveLength(3);
        expect(slugs.at(-1)).toBe(slug);
        expect(slugs).toEqual(
          expect.arrayContaining([catalog.ring.slug, catalog.earrings.slug]),
        );
      },
    );

    it('recommends open models after own products', async () => {
      const response = await request(server())
        .get(
          `/api/storefront/products/${catalog.earrings.slug}/recommendations`,
        )
        .expect(200);

      expect(
        (response.body as Array<{ slug: string }>).map((item) => item.slug),
      ).toEqual([catalog.ring.slug, slug]);
    });

    it('returns to the queue when its product is deleted', async () => {
      await request(server())
        .delete(`/api/products/${productId}`)
        .set('Cookie', admin)
        .expect(204);

      const id = await candidateId('Dragon Ring', '?status=approved');

      await request(server())
        .post(`/api/design-candidates/${id}/restore`)
        .set('Cookie', admin)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({ status: 'candidate', productId: null }),
        );
    });
  });
});
