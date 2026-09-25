import request from 'supertest';
import { CatalogFixture, createCatalog } from './support/catalog.fixtures';
import { cookieFor, createTestApp, TestContext } from './support/test.app';

describe('Catalog administration and storefront (e2e)', () => {
  let context: TestContext;
  let catalog: CatalogFixture;
  const admin = cookieFor('admin');

  beforeAll(async () => {
    context = await createTestApp();
    catalog = await createCatalog(context.app.getHttpServer());
  });

  afterAll(async () => {
    await context.close();
  });

  const server = () => context.app.getHttpServer();

  describe('administration', () => {
    it('forbids catalog management for customers', async () => {
      await request(server())
        .post('/api/products')
        .set('Cookie', cookieFor('customer'))
        .send({})
        .expect(403);
      await request(server()).get('/api/products').expect(401);
    });

    it('lists products in every status with filters', async () => {
      const all = await request(server())
        .get('/api/products')
        .set('Cookie', admin)
        .expect(200);
      expect(all.body.total).toBe(3);

      const drafts = await request(server())
        .get('/api/products?status=draft')
        .set('Cookie', admin)
        .expect(200);
      expect(drafts.body.items.map((p: { slug: string }) => p.slug)).toEqual([
        'secret-ring',
      ]);
    });

    it('returns the full product with ordered options and a single default', async () => {
      const response = await request(server())
        .get(`/api/products/${catalog.ring.id}`)
        .set('Cookie', admin)
        .expect(200);

      expect(response.body).toMatchObject({
        slug: 'aurora-ring',
        collection: { slug: 'aurora' },
        tags: [{ slug: 'wedding' }],
        images: [{ publicId: 'jewelry/products/aurora-ring' }],
      });
      expect(
        response.body.optionGroups.map((g: { kind: string }) => g.kind),
      ).toEqual(['metal', 'size', 'engraving']);
      expect(response.body.optionGroups[0].values[0].metal).toMatchObject({
        code: 'gold-585-yellow',
      });
    });

    it('keeps one default value per option group', async () => {
      const metalGroup = catalog.ring.optionGroups.find(
        (g) => g.kind === 'metal',
      )!;
      const response = await request(server())
        .patch(
          `/api/products/${catalog.ring.id}/option-groups/${metalGroup.id}/values/${catalog.values.platinum}`,
        )
        .set('Cookie', admin)
        .send({ isDefault: true })
        .expect(200);
      const defaults = response.body.optionGroups[0].values.filter(
        (v: { isDefault: boolean }) => v.isDefault,
      );
      expect(defaults).toHaveLength(1);

      await request(server())
        .patch(
          `/api/products/${catalog.ring.id}/option-groups/${metalGroup.id}/values/${catalog.values.gold}`,
        )
        .set('Cookie', admin)
        .send({ isDefault: true })
        .expect(200);
    });

    it('rejects duplicate slugs and deleting metals in use', async () => {
      await request(server())
        .post('/api/products')
        .set('Cookie', admin)
        .send({
          slug: 'aurora-ring',
          name: 'Дубль',
          type: 'ring',
          basePrice: 1,
        })
        .expect(409);

      const metals = await request(server())
        .get('/api/metals')
        .set('Cookie', admin)
        .expect(200);
      const gold = metals.body.find(
        (m: { code: string }) => m.code === 'gold-585-yellow',
      );
      await request(server())
        .delete(`/api/metals/${gold.id}`)
        .set('Cookie', admin)
        .expect(409);
    });

    it('signs admin uploads into application folders', async () => {
      const response = await request(server())
        .post('/api/media/upload-signature')
        .set('Cookie', admin)
        .send({ folder: 'products' })
        .expect(200);

      expect(response.body).toMatchObject({
        cloudName: 'demo-cloud',
        folder: 'jewelry/products',
      });
      expect(response.body.signature).toMatch(/^[a-f0-9]{40}$/);

      await request(server())
        .post('/api/media/upload-signature')
        .set('Cookie', admin)
        .send({ folder: '../other' })
        .expect(400);
    });
  });

  describe('storefront', () => {
    it('shows only published products and supports filters', async () => {
      const all = await request(server())
        .get('/api/storefront/products')
        .expect(200);
      expect(all.body.total).toBe(2);

      const platinum = await request(server())
        .get('/api/storefront/products?metals=platinum-950')
        .expect(200);
      expect(platinum.body.items).toHaveLength(1);
      expect(platinum.body.items[0]).toMatchObject({
        slug: 'aurora-ring',
        priceFrom: 1_000_000,
        collection: { slug: 'aurora' },
        images: [{ alt: 'Каблучка Aurora' }],
      });
      expect(platinum.body.items[0].metals).toEqual([
        { code: 'gold-585-yellow', name: 'Жовте золото 585' },
        { code: 'platinum-950', name: 'Платина 950' },
      ]);

      const inStock = await request(server())
        .get('/api/storefront/products?inStock=true&sort=price_asc')
        .expect(200);
      expect(inStock.body.items.map((p: { slug: string }) => p.slug)).toEqual([
        'aurora-earrings',
      ]);

      const tagged = await request(server())
        .get('/api/storefront/products?tags=wedding&collection=aurora')
        .expect(200);
      expect(tagged.body.total).toBe(1);

      await request(server())
        .get('/api/storefront/products/secret-ring')
        .expect(404);
    });

    it('returns the product page with a default quote', async () => {
      const response = await request(server())
        .get('/api/storefront/products/aurora-ring')
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Каблучка Aurora',
        inStock: false,
        collection: { slug: 'aurora', isSet: true, setDiscountPercent: 10 },
        defaultQuote: {
          unitPrice: 1_000_000,
          productionDaysMin: 10,
          productionDaysMax: 14,
        },
      });
    });

    it('quotes a configuration server-side', async () => {
      const response = await request(server())
        .post('/api/storefront/products/aurora-ring/quote')
        .send({
          optionValueIds: [
            catalog.values.platinum,
            catalog.values.size175,
            catalog.values.engraving,
          ],
          engravingText: 'Назавжди',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        unitPrice: 1_850_000,
        productionDaysMin: 16,
        productionDaysMax: 20,
        engravingText: 'Назавжди',
      });

      await request(server())
        .post('/api/storefront/products/aurora-ring/quote')
        .send({ optionValueIds: [catalog.values.engraving] })
        .expect(400);
    });

    it('serves home, collections, filters, and recommendations', async () => {
      const home = await request(server())
        .get('/api/storefront/home')
        .expect(200);
      expect(home.body.featuredCollections[0]).toMatchObject({
        slug: 'aurora',
        productCount: 2,
      });
      expect(
        home.body.hotProducts.map((p: { slug: string }) => p.slug),
      ).toEqual(['aurora-ring']);

      const collection = await request(server())
        .get('/api/storefront/collections/aurora')
        .expect(200);
      expect(collection.body).toMatchObject({
        setPrice: 1_500_000,
        setPriceDiscounted: 1_350_000,
      });
      expect(collection.body.products).toHaveLength(2);

      const filters = await request(server())
        .get('/api/storefront/filters')
        .expect(200);
      expect(filters.body).toMatchObject({
        types: ['ring', 'earrings'],
        priceRange: { min: 500_000, max: 1_000_000 },
        collections: [{ slug: 'aurora' }],
      });

      const recommendations = await request(server())
        .get('/api/storefront/products/aurora-ring/recommendations')
        .expect(200);
      expect(recommendations.body.map((p: { slug: string }) => p.slug)).toEqual(
        ['aurora-earrings'],
      );
    });
  });
});
