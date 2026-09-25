import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  collections,
  gemstones,
  metals,
  optionGroups,
  optionValues,
  PRODUCT_TYPES,
  products,
  productTags,
  tags,
} from '../../integrations/database/database.schema';
import { qualified } from '../../integrations/database/database.sql';
import { toOffset, toPage } from '../../shared/pagination/pagination';
import type {
  ProductCardDto,
  ProductCardPageDto,
} from '../catalog/dto/product.card.dto';
import {
  isPublished,
  ProductCatalogService,
} from '../catalog/product.catalog.service';
import {
  configureProduct,
  ConfigurationError,
} from '../catalog/product.configuration';
import type { ProductDetails } from '../catalog/products.service';
import { ReferenceDataService } from '../catalog/reference.data.service';
import { rankRecommendations } from './recommendations';
import type {
  QuoteDto,
  QuoteRequestDto,
  StorefrontCollectionDetailsDto,
  StorefrontCollectionDto,
  StorefrontFiltersDto,
  StorefrontHomeDto,
  StorefrontProductDto,
  StorefrontProductQueryDto,
} from './storefront.dto';

const HOME_SECTION_SIZE = 8;
const RECOMMENDATION_CANDIDATES = 500;
const publishedCollection = eq(collections.status, 'published');

@Injectable()
export class StorefrontService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly catalog: ProductCatalogService,
    private readonly referenceData: ReferenceDataService,
  ) {}

  async home(): Promise<StorefrontHomeDto> {
    const [featuredCollections, hotProducts, newProducts, featuredProducts] =
      await Promise.all([
        this.collections(eq(collections.isFeatured, true), 6),
        this.catalog.cards({
          where: eq(products.isHot, true),
          limit: HOME_SECTION_SIZE,
        }),
        this.catalog.cards({
          where: eq(products.isNew, true),
          orderBy: [sql`${products.publishedAt} desc nulls last`],
          limit: HOME_SECTION_SIZE,
        }),
        this.catalog.cards({
          where: eq(products.isFeatured, true),
          limit: HOME_SECTION_SIZE,
        }),
      ]);

    return { featuredCollections, hotProducts, newProducts, featuredProducts };
  }

  async listProducts(
    query: StorefrontProductQueryDto,
  ): Promise<ProductCardPageDto> {
    const where = this.productFilters(query);
    const [items, total] = await Promise.all([
      this.catalog.cards({
        where,
        orderBy: this.productOrder(query.sort),
        limit: query.pageSize,
        offset: toOffset(query),
      }),
      this.catalog.count(where),
    ]);

    return toPage(items, total, query);
  }

  async getProduct(slug: string): Promise<StorefrontProductDto> {
    return this.toStorefrontProduct(await this.findProduct(slug));
  }

  async quote(slug: string, dto: QuoteRequestDto): Promise<QuoteDto> {
    const product = await this.findProduct(slug);

    try {
      return configureProduct(
        this.availableOnly(product),
        dto.optionValueIds,
        dto.engravingText,
      );
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  async recommendations(
    slug: string,
    limit: number,
  ): Promise<ProductCardDto[]> {
    const product = await this.findProduct(slug);
    const candidates = await this.db
      .select({
        id: products.id,
        collectionId: products.collectionId,
        type: products.type,
        isHot: products.isHot,
        tagIds: sql<
          string[]
        >`coalesce((select array_agg(${qualified(productTags.tagId)}) from ${productTags} where ${qualified(productTags.productId)} = ${qualified(products.id)}), '{}')`,
      })
      .from(products)
      .where(isPublished)
      .orderBy(...this.catalog.defaultOrder())
      .limit(RECOMMENDATION_CANDIDATES);

    const ids = rankRecommendations(
      {
        id: product.id,
        collectionId: product.collectionId,
        type: product.type,
        isHot: product.isHot,
        tagIds: product.tags.map((tag) => tag.id),
      },
      candidates,
      limit,
    );

    return this.catalog.cardsByIds(ids);
  }

  listCollections(): Promise<StorefrontCollectionDto[]> {
    return this.collections(undefined, 100);
  }

  async getCollection(slug: string): Promise<StorefrontCollectionDetailsDto> {
    const [collection] = await this.collections(eq(collections.slug, slug), 1);

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    const items = await this.catalog.cards({
      where: eq(products.collectionId, collection.id),
      limit: 200,
    });
    const setPrice = collection.isSet
      ? items.reduce((sum, item) => sum + item.priceFrom, 0)
      : null;

    return {
      ...collection,
      products: items,
      setPrice,
      setPriceDiscounted:
        setPrice === null
          ? null
          : setPrice -
            items.reduce(
              (sum, item) =>
                sum +
                Math.round(
                  (item.priceFrom * collection.setDiscountPercent) / 100,
                ),
              0,
            ),
    };
  }

  async filters(): Promise<StorefrontFiltersDto> {
    const [tagList, metalList, gemstoneList, collectionList, [range], types] =
      await Promise.all([
        this.referenceData.listTags(),
        this.referenceData.listMetals(true),
        this.referenceData.listGemstones(true),
        this.db
          .select({
            slug: collections.slug,
            name: collections.name,
            isSet: collections.isSet,
            setDiscountPercent: collections.setDiscountPercent,
          })
          .from(collections)
          .where(publishedCollection)
          .orderBy(asc(collections.sortOrder), asc(collections.name)),
        this.db
          .select({
            min: sql<number>`coalesce(min(${products.basePrice}), 0)::int`,
            max: sql<number>`coalesce(max(${products.basePrice}), 0)::int`,
          })
          .from(products)
          .where(isPublished),
        this.db
          .selectDistinct({ type: products.type })
          .from(products)
          .where(isPublished),
      ]);
    const present = new Set(types.map((row) => row.type));

    return {
      types: PRODUCT_TYPES.filter((type) => present.has(type)),
      tags: tagList,
      metals: metalList,
      gemstones: gemstoneList,
      collections: collectionList,
      priceRange: range,
    };
  }

  private async findProduct(slug: string): Promise<ProductDetails> {
    const product = await this.catalog.findDetailsBySlug(slug);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  /** Hides unavailable values so customers cannot select them. */
  private availableOnly(product: ProductDetails): ProductDetails {
    return {
      ...product,
      optionGroups: product.optionGroups.map((group) => ({
        ...group,
        values: group.values.filter((value) => value.isAvailable),
      })),
    };
  }

  private toStorefrontProduct(details: ProductDetails): StorefrontProductDto {
    const product = this.availableOnly(details);
    let defaultQuote: QuoteDto | null = null;

    try {
      defaultQuote = configureProduct(product, []);
    } catch {
      defaultQuote = null;
    }

    const collection =
      product.collection?.status === 'published' ? product.collection : null;

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      type: product.type,
      shortDescription: product.shortDescription,
      description: product.description,
      specifications: product.specifications,
      availability: product.availability,
      inStock: product.availability === 'in_stock' && product.stockQuantity > 0,
      isHot: product.isHot,
      isNew: product.isNew,
      isFeatured: product.isFeatured,
      basePrice: product.basePrice,
      productionDaysMin: product.productionDaysMin,
      productionDaysMax: product.productionDaysMax,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      collection: collection && {
        slug: collection.slug,
        name: collection.name,
        isSet: collection.isSet,
        setDiscountPercent: collection.setDiscountPercent,
      },
      tags: product.tags,
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
        alt: image.alt,
        optionValueId: image.optionValueId,
      })),
      optionGroups: product.optionGroups
        .filter((group) => group.values.length)
        .map((group) => ({
          id: group.id,
          kind: group.kind,
          name: group.name,
          isRequired: group.isRequired,
          values: group.values.map((value) => ({
            id: value.id,
            label: value.label,
            metal: value.metal,
            gemstone: value.gemstone,
            stoneCarat: value.stoneCarat,
            stoneSizeMm: value.stoneSizeMm,
            ringSize: value.ringSize,
            priceDelta: value.priceDelta,
            productionDaysDelta: value.productionDaysDelta,
            isDefault: value.isDefault,
          })),
        })),
      defaultQuote,
    };
  }

  private collections(
    where: SQL | undefined,
    limit: number,
  ): Promise<Array<StorefrontCollectionDto & { id: string }>> {
    return this.db
      .select({
        id: collections.id,
        slug: collections.slug,
        name: collections.name,
        subtitle: collections.subtitle,
        description: collections.description,
        coverImage: collections.coverImage,
        gallery: collections.gallery,
        isFeatured: collections.isFeatured,
        isSet: collections.isSet,
        setDiscountPercent: collections.setDiscountPercent,
        seoTitle: collections.seoTitle,
        seoDescription: collections.seoDescription,
        productCount: sql<number>`(select count(*)::int from ${products} where ${qualified(products.collectionId)} = ${qualified(collections.id)} and ${qualified(products.status)} = 'published')`,
      })
      .from(collections)
      .where(and(publishedCollection, where))
      .orderBy(asc(collections.sortOrder), asc(collections.name))
      .limit(limit);
  }

  private productFilters(query: StorefrontProductQueryDto): SQL | undefined {
    const conditions: SQL[] = [];

    if (query.collection) {
      conditions.push(
        inArray(
          products.collectionId,
          this.db
            .select({ id: collections.id })
            .from(collections)
            .where(
              and(eq(collections.slug, query.collection), publishedCollection),
            ),
        ),
      );
    }

    if (query.tags?.length) {
      conditions.push(
        exists(
          this.db
            .select({ one: sql`1` })
            .from(productTags)
            .innerJoin(tags, eq(tags.id, productTags.tagId))
            .where(
              and(
                eq(productTags.productId, products.id),
                inArray(tags.slug, query.tags),
              ),
            ),
        ),
      );
    }

    if (query.metals?.length) {
      conditions.push(
        this.hasOption(
          and(
            eq(metals.id, optionValues.metalId),
            inArray(metals.code, query.metals),
          )!,
          metals,
        ),
      );
    }

    if (query.gemstones?.length) {
      conditions.push(
        this.hasOption(
          and(
            eq(gemstones.id, optionValues.gemstoneId),
            inArray(gemstones.code, query.gemstones),
          )!,
          gemstones,
        ),
      );
    }

    if (query.type) conditions.push(eq(products.type, query.type));
    if (query.priceMin !== undefined) {
      conditions.push(gte(products.basePrice, query.priceMin));
    }
    if (query.priceMax !== undefined) {
      conditions.push(lte(products.basePrice, query.priceMax));
    }
    if (query.inStock) {
      conditions.push(
        sql`${products.availability} = 'in_stock' and ${products.stockQuantity} > 0`,
      );
    }
    if (query.hot) conditions.push(eq(products.isHot, true));
    if (query.new) conditions.push(eq(products.isNew, true));
    if (query.q) {
      const pattern = `%${query.q.trim()}%`;
      conditions.push(
        or(
          ilike(products.name, pattern),
          ilike(products.shortDescription, pattern),
        )!,
      );
    }

    return conditions.length ? and(...conditions) : undefined;
  }

  private hasOption(
    joinCondition: SQL,
    table: typeof metals | typeof gemstones,
  ): SQL {
    return exists(
      this.db
        .select({ one: sql`1` })
        .from(optionValues)
        .innerJoin(optionGroups, eq(optionGroups.id, optionValues.groupId))
        .innerJoin(table, joinCondition)
        .where(
          and(
            eq(optionGroups.productId, products.id),
            eq(optionValues.isAvailable, true),
          ),
        ),
    );
  }

  private productOrder(sort: StorefrontProductQueryDto['sort']): SQL[] {
    switch (sort) {
      case 'newest':
        return [sql`${products.publishedAt} desc nulls last`];
      case 'price_asc':
        return [sql`${products.basePrice} asc`];
      case 'price_desc':
        return [sql`${products.basePrice} desc`];
      default:
        return [
          sql`${products.isFeatured} desc`,
          ...this.catalog.defaultOrder(),
        ];
    }
  }
}
