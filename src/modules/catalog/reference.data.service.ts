import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  gemstones,
  metals,
  tags,
} from '../../integrations/database/database.schema';
import { withConflictMapping } from '../../shared/errors/conflict.mapping';
import type {
  CreateGemstoneDto,
  CreateMetalDto,
  CreateTagDto,
  GemstoneDto,
  MetalDto,
  TagDto,
  UpdateGemstoneDto,
  UpdateMetalDto,
  UpdateTagDto,
} from './dto/reference.dto';

function found<T>(row: T | undefined, message: string): T {
  if (!row) {
    throw new NotFoundException(message);
  }

  return row;
}

/** Metals, gemstones, and tags managed by administrators. */
@Injectable()
export class ReferenceDataService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  listMetals(activeOnly = false): Promise<MetalDto[]> {
    return this.db
      .select()
      .from(metals)
      .where(activeOnly ? eq(metals.isActive, true) : undefined)
      .orderBy(asc(metals.sortOrder), asc(metals.name));
  }

  async createMetal(dto: CreateMetalDto): Promise<MetalDto> {
    const [row] = await withConflictMapping(
      this.db.insert(metals).values(dto).returning(),
      { unique: 'Metal code already exists' },
    );
    return row;
  }

  async updateMetal(id: string, dto: UpdateMetalDto): Promise<MetalDto> {
    const [row] = await withConflictMapping(
      this.db.update(metals).set(dto).where(eq(metals.id, id)).returning(),
      { unique: 'Metal code already exists' },
    );
    return found(row, 'Metal not found');
  }

  async deleteMetal(id: string): Promise<void> {
    const [row] = await withConflictMapping(
      this.db.delete(metals).where(eq(metals.id, id)).returning(),
      { inUse: 'Metal is used by product options; deactivate it instead' },
    );
    found(row, 'Metal not found');
  }

  listGemstones(activeOnly = false): Promise<GemstoneDto[]> {
    return this.db
      .select()
      .from(gemstones)
      .where(activeOnly ? eq(gemstones.isActive, true) : undefined)
      .orderBy(asc(gemstones.sortOrder), asc(gemstones.name));
  }

  async createGemstone(dto: CreateGemstoneDto): Promise<GemstoneDto> {
    const [row] = await withConflictMapping(
      this.db.insert(gemstones).values(dto).returning(),
      { unique: 'Gemstone code already exists' },
    );
    return row;
  }

  async updateGemstone(
    id: string,
    dto: UpdateGemstoneDto,
  ): Promise<GemstoneDto> {
    const [row] = await withConflictMapping(
      this.db
        .update(gemstones)
        .set(dto)
        .where(eq(gemstones.id, id))
        .returning(),
      { unique: 'Gemstone code already exists' },
    );
    return found(row, 'Gemstone not found');
  }

  async deleteGemstone(id: string): Promise<void> {
    const [row] = await withConflictMapping(
      this.db.delete(gemstones).where(eq(gemstones.id, id)).returning(),
      { inUse: 'Gemstone is used by product options; deactivate it instead' },
    );
    found(row, 'Gemstone not found');
  }

  listTags(): Promise<TagDto[]> {
    return this.db
      .select()
      .from(tags)
      .orderBy(asc(tags.sortOrder), asc(tags.name));
  }

  async createTag(dto: CreateTagDto): Promise<TagDto> {
    const [row] = await withConflictMapping(
      this.db.insert(tags).values(dto).returning(),
      { unique: 'Tag slug already exists' },
    );
    return row;
  }

  async updateTag(id: string, dto: UpdateTagDto): Promise<TagDto> {
    const [row] = await withConflictMapping(
      this.db.update(tags).set(dto).where(eq(tags.id, id)).returning(),
      { unique: 'Tag slug already exists' },
    );
    return found(row, 'Tag not found');
  }

  async deleteTag(id: string): Promise<void> {
    const [row] = await this.db.delete(tags).where(eq(tags.id, id)).returning();
    found(row, 'Tag not found');
  }
}
