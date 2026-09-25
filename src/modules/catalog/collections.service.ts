import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, getTableColumns, sql } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  collections,
  products,
} from '../../integrations/database/database.schema';
import type { PublicationStatus } from '../../integrations/database/database.schema';
import { qualified } from '../../integrations/database/database.sql';
import { withConflictMapping } from '../../shared/errors/conflict.mapping';
import type {
  AdminCollectionDto,
  CollectionDto,
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

  async get(id: string): Promise<CollectionDto> {
    const [row] = await this.db
      .select()
      .from(collections)
      .where(eq(collections.id, id));

    if (!row) {
      throw new NotFoundException('Collection not found');
    }

    return row;
  }

  async create(dto: CreateCollectionDto): Promise<CollectionDto> {
    const [row] = await withConflictMapping(
      this.db
        .insert(collections)
        .values({ ...dto, ...publicationFields(dto.status) })
        .returning(),
      { unique: 'Collection slug already exists' },
    );
    return row;
  }

  async update(id: string, dto: UpdateCollectionDto): Promise<CollectionDto> {
    const current = await this.get(id);
    const [row] = await withConflictMapping(
      this.db
        .update(collections)
        .set({ ...dto, ...publicationFields(dto.status, current.publishedAt) })
        .where(eq(collections.id, id))
        .returning(),
      { unique: 'Collection slug already exists' },
    );
    return row;
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
