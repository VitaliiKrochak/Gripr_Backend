import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ne } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import { resins } from '../../integrations/database/database.schema';
import { withConflictMapping } from '../../shared/errors/conflict.mapping';
import { printPriced, refreshPriceFrom } from '../catalog/product.pricing';
import type {
  CreateResinDto,
  ResinDto,
  StorefrontResinDto,
  UpdateResinDto,
} from './dto/resin.dto';

const DUPLICATE_CODE = 'Resin code already exists';

@Injectable()
export class ResinsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  list(): Promise<ResinDto[]> {
    return this.db
      .select()
      .from(resins)
      .orderBy(asc(resins.sortOrder), asc(resins.name));
  }

  listForStorefront(): Promise<StorefrontResinDto[]> {
    return this.db
      .select({
        id: resins.id,
        code: resins.code,
        name: resins.name,
        kind: resins.kind,
        colour: resins.colour,
        description: resins.description,
        isDefault: resins.isDefault,
      })
      .from(resins)
      .where(eq(resins.isActive, true))
      .orderBy(asc(resins.sortOrder), asc(resins.name));
  }

  async create(dto: CreateResinDto): Promise<ResinDto> {
    return withConflictMapping(
      this.db.transaction(async (tx) => {
        const [row] = await tx.insert(resins).values(dto).returning();
        await keepSingleDefault(tx, row);
        await refreshPriceFrom(tx, printPriced);
        return row;
      }),
      { unique: DUPLICATE_CODE },
    );
  }

  async update(id: string, dto: UpdateResinDto): Promise<ResinDto> {
    const row = await withConflictMapping(
      this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(resins)
          .set(dto)
          .where(eq(resins.id, id))
          .returning();

        if (updated) {
          await keepSingleDefault(tx, updated);
          await refreshPriceFrom(tx, printPriced);
        }

        return updated;
      }),
      { unique: DUPLICATE_CODE },
    );

    if (!row) {
      throw new NotFoundException('Resin not found');
    }

    return row;
  }

  async delete(id: string): Promise<void> {
    const [row] = await withConflictMapping(
      this.db.transaction(async (tx) => {
        const deleted = await tx
          .delete(resins)
          .where(eq(resins.id, id))
          .returning();
        await refreshPriceFrom(tx, printPriced);
        return deleted;
      }),
      {
        inUse:
          'Resin is used by products or print requests; deactivate it instead',
      },
    );

    if (!row) {
      throw new NotFoundException('Resin not found');
    }
  }
}

async function keepSingleDefault(
  executor: DatabaseExecutor,
  resin: { id: string; isDefault: boolean },
): Promise<void> {
  if (resin.isDefault) {
    await executor
      .update(resins)
      .set({ isDefault: false })
      .where(and(ne(resins.id, resin.id), eq(resins.isDefault, true)));
  }
}
