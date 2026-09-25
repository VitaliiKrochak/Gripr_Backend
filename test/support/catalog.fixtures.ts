import request from 'supertest';
import { App } from 'supertest/types';
import { cookieFor } from './test.app';

interface Product {
  id: string;
  slug: string;
  optionGroups: Array<{
    id: string;
    kind: string;
    values: Array<{ id: string; label: string }>;
  }>;
}

export interface CatalogFixture {
  collectionId: string;
  tagId: string;
  ring: Product;
  earrings: Product;
  draft: Product;
  values: {
    gold: string;
    platinum: string;
    size16: string;
    size175: string;
    engraving: string;
  };
}

/** Builds a small catalog through the admin API. */
export async function createCatalog(server: App): Promise<CatalogFixture> {
  const admin = cookieFor('admin');
  const post = async <T>(url: string, body: object): Promise<T> => {
    const response = await request(server)
      .post(url)
      .set('Cookie', admin)
      .send(body);

    if (response.status !== 201) {
      throw new Error(
        `POST ${url} failed: ${response.status} ${JSON.stringify(response.body)}`,
      );
    }

    return response.body as T;
  };

  const metals = (
    await request(server).get('/api/metals').set('Cookie', admin).expect(200)
  ).body as Array<{ id: string; code: string }>;
  const metal = (code: string) => metals.find((m) => m.code === code)!.id;

  const tag = await post<{ id: string }>('/api/tags', {
    slug: 'wedding',
    name: 'Весільні',
    group: 'occasion',
  });
  const collection = await post<{ id: string }>('/api/collections', {
    slug: 'aurora',
    name: 'Aurora',
    description: 'Історія колекції',
    status: 'published',
    isFeatured: true,
    isSet: true,
    setDiscountPercent: 10,
  });

  let ring = await post<Product>('/api/products', {
    slug: 'aurora-ring',
    name: 'Каблучка Aurora',
    type: 'ring',
    status: 'published',
    collectionId: collection.id,
    tagIds: [tag.id],
    basePrice: 1_000_000,
    productionDaysMin: 10,
    productionDaysMax: 14,
    isHot: true,
    specifications: [{ label: 'Вага', value: '3.2 г' }],
  });

  const metalGroup = (
    await post<Product>(`/api/products/${ring.id}/option-groups`, {
      kind: 'metal',
      name: 'Метал',
      sortOrder: 0,
    })
  ).optionGroups[0];
  await post(`/api/products/${ring.id}/option-groups/${metalGroup.id}/values`, {
    label: 'Жовте золото 585',
    metalId: metal('gold-585-yellow'),
    isDefault: true,
  });
  await post(`/api/products/${ring.id}/option-groups/${metalGroup.id}/values`, {
    label: 'Платина 950',
    metalId: metal('platinum-950'),
    priceDelta: 800_000,
    productionDaysDelta: 5,
  });

  const sizeGroup = (
    await post<Product>(`/api/products/${ring.id}/option-groups`, {
      kind: 'size',
      name: 'Розмір',
      sortOrder: 1,
    })
  ).optionGroups.find((group) => group.kind === 'size')!;
  await post(`/api/products/${ring.id}/option-groups/${sizeGroup.id}/values`, {
    label: '16',
    ringSize: 16,
    isDefault: true,
  });
  await post(`/api/products/${ring.id}/option-groups/${sizeGroup.id}/values`, {
    label: '17.5',
    ringSize: 17.5,
    priceDelta: 20_000,
  });

  const engravingGroup = (
    await post<Product>(`/api/products/${ring.id}/option-groups`, {
      kind: 'engraving',
      name: 'Гравіювання',
      isRequired: false,
      sortOrder: 2,
    })
  ).optionGroups.find((group) => group.kind === 'engraving')!;
  ring = await post<Product>(
    `/api/products/${ring.id}/option-groups/${engravingGroup.id}/values`,
    { label: 'Гравіювання', priceDelta: 30_000, productionDaysDelta: 1 },
  );
  await post(`/api/products/${ring.id}/images`, {
    publicId: 'jewelry/products/aurora-ring',
    url: 'https://res.cloudinary.com/demo-cloud/image/upload/jewelry/products/aurora-ring.jpg',
    alt: 'Каблучка Aurora',
  });

  const earrings = await post<Product>('/api/products', {
    slug: 'aurora-earrings',
    name: 'Сережки Aurora',
    type: 'earrings',
    status: 'published',
    collectionId: collection.id,
    basePrice: 500_000,
    availability: 'in_stock',
    stockQuantity: 2,
  });
  const draft = await post<Product>('/api/products', {
    slug: 'secret-ring',
    name: 'Чернетка',
    type: 'ring',
    basePrice: 100_000,
  });

  const value = (kind: string, label: string) =>
    ring.optionGroups
      .find((group) => group.kind === kind)!
      .values.find((v) => v.label === label)!.id;

  return {
    collectionId: collection.id,
    tagId: tag.id,
    ring,
    earrings,
    draft,
    values: {
      gold: value('metal', 'Жовте золото 585'),
      platinum: value('metal', 'Платина 950'),
      size16: value('size', '16'),
      size175: value('size', '17.5'),
      engraving: value('engraving', 'Гравіювання'),
    },
  };
}
