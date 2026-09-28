import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import {
  productImages,
  products,
  productStones,
  productTags,
} from '../../integrations/database/database.schema';
import { qualified } from '../../integrations/database/database.sql';
import { toOffset, toPage } from '../../shared/pagination/pagination';
import { withConflictMapping } from '../../shared/errors/conflict.mapping';
import { toDesignCredit } from '../designs/design.credit';
import { publicationFields } from './collections.service';
import type {
  AdminProductDto,
  AdminProductListQueryDto,
  AdminProductPageDto,
  CreateProductDto,
  UpdateProductDto,
} from './dto/product.dto';
import { refreshPriceFrom } from './product.pricing';
import { saveProductStructure, touchProduct } from './product.structure';

const SLUG_CONFLICT = 'Product slug already exists';
const MISSING_REFERENCE =
  'Collection, tag, metal, gemstone, or operation does not exist';

@Injectable()
export class ProductsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(query: AdminProductListQueryDto): Promise<AdminProductPageDto> {
    const conditions: SQL[] = [];

    if (query.status) conditions.push(eq(products.status, query.status));
    if (query.type) conditions.push(eq(products.type, query.type));
    if (query.collectionId) {
      conditions.push(eq(products.collectionId, query.collectionId));
    }
    if (query.q) {
      const pattern = `%${query.q.trim()}%`;
      conditions.push(
        or(ilike(products.name, pattern), ilike(products.slug, pattern))!,
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const [items, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
          type: products.type,
          status: products.status,
          basePrice: products.basePrice,
          priceFrom: products.priceFrom,
          availability: products.availability,
          stockQuantity: products.stockQuantity,
          isHot: products.isHot,
          isNew: products.isNew,
          isFeatured: products.isFeatured,
          sortOrder: products.sortOrder,
          collectionId: products.collectionId,
          imageUrl: sql<
            string | null
          >`(select ${qualified(productImages.url)} from ${productImages} where ${qualified(productImages.productId)} = ${qualified(products.id)} order by ${qualified(productImages.sortOrder)} limit 1)`,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .where(where)
        .orderBy(desc(products.updatedAt))
        .limit(query.pageSize)
        .offset(toOffset(query)),
      this.db.select({ total: count() }).from(products).where(where),
    ]);

    return toPage(items, total, query);
  }

  async get(id: string): Promise<AdminProductDto> {
    const product = await loadProductDetails(this.db, eq(products.id, id));

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async create(dto: CreateProductDto): Promise<AdminProductDto> {
    const { tagIds, stones, optionGroups, images, ...values } = dto;
    assertProductionDays(values.productionDaysMin, values.productionDaysMax);

    const id = await withConflictMapping(
      this.db.transaction(async (tx) => {
        const [product] = await tx
          .insert(products)
          .values({ ...values, ...publicationFields(values.status) })
          .returning({ id: products.id });
        await replaceTags(tx, product.id, tagIds);
        await saveProductStructure(tx, product.id, values.type, {
          stones,
          optionGroups,
          images,
        });
        await refreshPriceFrom(tx, eq(products.id, product.id));
        return product.id;
      }),
      { unique: SLUG_CONFLICT, inUse: MISSING_REFERENCE },
    );

    return this.get(id);
  }

  async update(id: string, dto: UpdateProductDto): Promise<AdminProductDto> {
    const current = await this.get(id);
    const { tagIds, stones, optionGroups, images, ...values } = dto;
    assertProductionDays(
      values.productionDaysMin ?? current.productionDaysMin,
      values.productionDaysMax ?? current.productionDaysMax,
    );

    await withConflictMapping(
      this.db.transaction(async (tx) => {
        if (Object.keys(values).length) {
          await tx
            .update(products)
            .set({
              ...values,
              ...publicationFields(values.status, current.publishedAt),
            })
            .where(eq(products.id, id));
        } else if (stones || optionGroups || images) {
          await touchProduct(tx, id);
        }

        if (tagIds) {
          await replaceTags(tx, id, tagIds);
        }

        await saveProductStructure(tx, id, values.type ?? current.type, {
          stones,
          optionGroups,
          images,
        });
        await refreshPriceFrom(tx, eq(products.id, id));

        if (current.designCredit) {
          await assertPricedForPublishing(tx, id);
        }
      }),
      { unique: SLUG_CONFLICT, inUse: MISSING_REFERENCE },
    );

    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const [row] = await this.db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });

    if (!row) {
      throw new NotFoundException('Product not found');
    }
  }
}

function assertProductionDays(min = 0, max = 0): void {
  if (min > max) {
    throw new BadRequestException(
      'productionDaysMin must not exceed productionDaysMax',
    );
  }
}

async function assertPricedForPublishing(
  executor: DatabaseExecutor,
  productId: string,
): Promise<void> {
  const [row] = await executor
    .select({ status: products.status, priceFrom: products.priceFrom })
    .from(products)
    .where(eq(products.id, productId));

  if (row?.status === 'published' && row.priceFrom <= 0) {
    throw new ConflictException(
      'Set a price before publishing a product made from an open design',
    );
  }
}

async function replaceTags(
  executor: DatabaseExecutor,
  productId: string,
  tagIds: string[] | undefined,
): Promise<void> {
  if (!tagIds) {
    return;
  }

  await executor
    .delete(productTags)
    .where(eq(productTags.productId, productId));

  if (tagIds.length) {
    await executor
      .insert(productTags)
      .values(tagIds.map((tagId) => ({ productId, tagId })));
  }
}

/** Loads a product with collection, tags, images, stones, and ordered options. */
export async function loadProductDetails(db: DatabaseExecutor, where: SQL) {
  const product = await db.query.products.findFirst({
    where,
    with: {
      collection: {
        columns: {
          id: true,
          slug: true,
          name: true,
          status: true,
          isSet: true,
          setDiscountPercent: true,
        },
      },
      images: { orderBy: [asc(productImages.sortOrder)] },
      stones: {
        orderBy: [asc(productStones.sortOrder)],
        with: { gemstone: true },
      },
      productTags: { with: { tag: true } },
      optionGroups: {
        orderBy: (groups) => [asc(groups.sortOrder), asc(groups.createdAt)],
        with: {
          values: {
            orderBy: (values) => [asc(values.sortOrder), asc(values.createdAt)],
            with: { metal: true, gemstone: true, finishing: true },
          },
        },
      },
      designCandidate: {
        columns: {
          title: true,
          authorName: true,
          authorUrl: true,
          source: true,
          sourceUrl: true,
          license: true,
        },
      },
    },
  });

  if (!product) {
    return undefined;
  }

  const { productTags: links, designCandidate, ...rest } = product;

  return {
    ...rest,
    tags: links
      .map((link) => link.tag)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    designCredit: toDesignCredit(designCandidate),
  };
}

export type ProductDetails = NonNullable<
  Awaited<ReturnType<typeof loadProductDetails>>
>;
