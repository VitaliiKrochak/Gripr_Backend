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
  getTableColumns,
  inArray,
  notInArray,
  sql,
} from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import {
  collections,
  productImages,
  products,
} from '../../integrations/database/database.schema';
import type { PublicationStatus } from '../../integrations/database/database.schema';
import { qualified } from '../../integrations/database/database.sql';
import { withConflictMapping } from '../../shared/errors/conflict.mapping';
import type {
  AdminCollectionDetailsDto,
  AdminCollectionDto,
  CollectionListQueryDto,
  CreateCollectionDto,
  UpdateCollectionDto,
} from './dto/collection.dto';

/** Sets `publishedAt` the first time a record becomes published. */
export function publicationFields(
  status: PublicationStatus | undefined,
  currentPublishedAt: Date | null = null,
): { publishedAt?: Date } {
  return status === 'published' && !currentPublishedAt
    ? { publishedAt: new Date() }
    : {};
}

const SLUG_CONFLICT = 'Collection slug already exists';

@Injectable()
export class CollectionsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  list(query: CollectionListQueryDto): Promise<AdminCollectionDto[]> {
    return this.db
      .select({
        ...getTableColumns(collections),
        productCount: sql<number>`(select count(*)::int from ${products} where ${qualified(products.collectionId)} = ${qualified(collections.id)})`,
      })
      .from(collections)
      .where(query.status ? eq(collections.status, query.status) : undefined)
      .orderBy(asc(collections.sortOrder), asc(collections.name));
  }

  async get(id: string): Promise<AdminCollectionDetailsDto> {
    const [row] = await this.db
      .select()
      .from(collections)
      .where(eq(collections.id, id));

    if (!row) {
      throw new NotFoundException('Collection not found');
    }

    const items = await this.db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        type: products.type,
        status: products.status,
        imageUrl: sql<
          string | null
        >`(select ${qualified(productImages.url)} from ${productImages} where ${qualified(productImages.productId)} = ${qualified(products.id)} order by ${qualified(productImages.sortOrder)} limit 1)`,
      })
      .from(products)
      .where(eq(products.collectionId, id))
      .orderBy(asc(products.collectionSortOrder), asc(products.name));

    return { ...row, products: items };
  }

  async create(dto: CreateCollectionDto): Promise<AdminCollectionDetailsDto> {
    const { productIds, ...values } = dto;
    const id = await withConflictMapping(
      this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(collections)
          .values({ ...values, ...publicationFields(values.status) })
          .returning({ id: collections.id });
        await replaceProducts(tx, row.id, productIds);
        return row.id;
      }),
      { unique: SLUG_CONFLICT },
    );
    return this.get(id);
  }

  async update(
    id: string,
    dto: UpdateCollectionDto,
  ): Promise<AdminCollectionDetailsDto> {
    const current = await this.get(id);
    const { productIds, ...values } = dto;
    await withConflictMapping(
      this.db.transaction(async (tx) => {
        await tx
          .update(collections)
          .set({
            ...values,
            ...publicationFields(values.status, current.publishedAt),
            updatedAt: new Date(),
          })
          .where(eq(collections.id, id));
        await replaceProducts(tx, id, productIds);
      }),
      { unique: SLUG_CONFLICT },
    );
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const [row] = await this.db
      .delete(collections)
      .where(eq(collections.id, id))
      .returning({ id: collections.id });

    if (!row) {
      throw new NotFoundException('Collection not found');
    }
  }
}

async function replaceProducts(
  tx: DatabaseExecutor,
  collectionId: string,
  productIds: string[] | undefined,
): Promise<void> {
  if (!productIds) {
    return;
  }

  if (productIds.length) {
    const found = await tx
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, productIds));

    if (found.length !== productIds.length) {
      throw new BadRequestException('Some products do not exist');
    }
  }

  await tx
    .update(products)
    .set({ collectionId: null, collectionSortOrder: 0 })
    .where(
      and(
        eq(products.collectionId, collectionId),
        productIds.length ? notInArray(products.id, productIds) : undefined,
      ),
    );

  for (const [index, productId] of productIds.entries()) {
    await tx
      .update(products)
      .set({ collectionId, collectionSortOrder: index })
      .where(eq(products.id, productId));
  }
}
