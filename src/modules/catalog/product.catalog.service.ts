import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import {
  collections,
  metals,
  optionGroups,
  optionValues,
  productImages,
  products,
} from '../../integrations/database/database.schema';
import type { ProductCardDto } from './dto/product.card.dto';
import type { ProductSet } from './product.configuration';
import { defaultProductOrder, ownProductsFirst } from './product.order';
import { loadProductDetails } from './products.service';

export const isPublished = eq(products.status, 'published');

/**
 * Read model shared by the storefront, favorites, cart, and orders. Only
 * published products are ever returned.
 */
@Injectable()
export class ProductCatalogService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  cards(options: {
    where?: SQL;
    orderBy?: SQL[];
    limit: number;
    offset?: number;
  }): Promise<ProductCardDto[]> {
    return this.db
      .select(this.cardColumns())
      .from(products)
      .leftJoin(collections, eq(collections.id, products.collectionId))
      .where(and(isPublished, options.where))
      .orderBy(
        ...(options.orderBy
          ? ownProductsFirst(options.orderBy)
          : defaultProductOrder()),
      )
      .limit(options.limit)
      .offset(options.offset ?? 0);
  }

  async count(where?: SQL): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(products)
      .where(and(isPublished, where));
    return total;
  }

  /**
   * Cards for the given ids in the same order; unpublished ids are skipped.
   * Callers must already have ranked open models after own products.
   */
  async cardsByIds(ids: string[]): Promise<ProductCardDto[]> {
    if (!ids.length) {
      return [];
    }

    const cards = await this.cards({
      where: inArray(products.id, ids),
      limit: ids.length,
    });
    const byId = new Map(cards.map((card) => [card.id, card]));

    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  /** Full published product by slug, see `loadProductDetails`. */
  findDetailsBySlug(slug: string) {
    return loadProductDetails(
      this.db,
      and(eq(products.slug, slug), isPublished)!,
    );
  }

  /** Published products with their options, keyed by id. */
  async loadConfigurable(
    productIds: string[],
    executor: DatabaseExecutor = this.db,
  ): Promise<Map<string, ConfigurableProductRecord>> {
    if (!productIds.length) {
      return new Map();
    }

    const rows = await this.findConfigurable(productIds, executor);

    return new Map(rows.map((row) => [row.id, row]));
  }

  findConfigurable(productIds: string[], executor: DatabaseExecutor = this.db) {
    return executor.query.products.findMany({
      where: and(inArray(products.id, productIds), isPublished),
      with: {
        images: {
          orderBy: [asc(productImages.sortOrder)],
          limit: 1,
          columns: { url: true },
        },
        optionGroups: {
          orderBy: (groups) => [asc(groups.sortOrder), asc(groups.createdAt)],
          with: {
            values: {
              orderBy: (values) => [
                asc(values.sortOrder),
                asc(values.createdAt),
              ],
            },
          },
        },
      },
    });
  }

  /** Published set collections that include at least one of the products. */
  async loadSets(
    collectionIds: string[],
    executor: DatabaseExecutor = this.db,
  ): Promise<ProductSet[]> {
    const ids = [...new Set(collectionIds)];

    if (!ids.length) {
      return [];
    }

    const rows = await executor
      .select({
        collectionId: collections.id,
        discountPercent: collections.setDiscountPercent,
        productId: products.id,
      })
      .from(collections)
      .innerJoin(
        products,
        and(eq(products.collectionId, collections.id), isPublished),
      )
      .where(
        and(
          inArray(collections.id, ids),
          eq(collections.status, 'published'),
          eq(collections.isSet, true),
          gt(collections.setDiscountPercent, 0),
        ),
      );
    const sets = new Map<string, ProductSet>();

    for (const row of rows) {
      const set = sets.get(row.collectionId) ?? {
        collectionId: row.collectionId,
        discountPercent: row.discountPercent,
        productIds: [],
      };
      set.productIds.push(row.productId);
      sets.set(row.collectionId, set);
    }

    return [...sets.values()];
  }

  private cardColumns() {
    return {
      id: products.id,
      slug: products.slug,
      name: products.name,
      type: products.type,
      shortDescription: products.shortDescription,
      priceFrom: products.basePrice,
      productionDaysMin: products.productionDaysMin,
      productionDaysMax: products.productionDaysMax,
      availability: products.availability,
      inStock: sql<boolean>`(${products.availability} = 'in_stock' and ${products.stockQuantity} > 0)`,
      isHot: products.isHot,
      isNew: products.isNew,
      isFeatured: products.isFeatured,
      images: sql<ProductCardDto['images']>`coalesce((
        select json_agg(json_build_object('url', i.url, 'alt', i.alt) order by i.sort_order)
        from (
          select ${productImages.url} as url, ${productImages.alt} as alt, ${productImages.sortOrder} as sort_order
          from ${productImages}
          where ${productImages.productId} = ${products.id} and ${productImages.optionValueId} is null
          order by ${productImages.sortOrder}
          limit 2
        ) i
      ), '[]'::json)`,
      metals: sql<ProductCardDto['metals']>`coalesce((
        select json_agg(json_build_object('code', m.code, 'name', m.name) order by m.sort_order)
        from (
          select distinct ${metals.code} as code, ${metals.name} as name, ${metals.sortOrder} as sort_order
          from ${optionValues}
          inner join ${optionGroups} on ${optionGroups.id} = ${optionValues.groupId}
          inner join ${metals} on ${metals.id} = ${optionValues.metalId}
          where ${optionGroups.productId} = ${products.id} and ${optionValues.isAvailable}
        ) m
      ), '[]'::json)`,
      collection: sql<
        ProductCardDto['collection']
      >`case when ${collections.id} is null then null else json_build_object('slug', ${collections.slug}, 'name', ${collections.name}) end`,
    };
  }
}

export type ConfigurableProductRecord = Awaited<
  ReturnType<ProductCatalogService['findConfigurable']>
>[number];
