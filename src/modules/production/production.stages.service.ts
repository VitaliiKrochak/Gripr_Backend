import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import { productionStages } from '../../integrations/database/database.schema';
import { withConflictMapping } from '../../shared/errors/conflict.mapping';
import type {
  CreateProductionStageDto,
  ProductionStageDto,
  UpdateProductionStageDto,
} from './dto/production.stage.dto';

const DUPLICATE_CODE = 'A production stage with this code already exists';

@Injectable()
export class ProductionStagesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  list(): Promise<ProductionStageDto[]> {
    return this.db
      .select()
      .from(productionStages)
      .orderBy(asc(productionStages.sortOrder), asc(productionStages.name));
  }

  async create(dto: CreateProductionStageDto): Promise<ProductionStageDto> {
    const [stage] = await withConflictMapping(
      this.db.insert(productionStages).values(dto).returning(),
      { unique: DUPLICATE_CODE },
    );
    return stage;
  }

  async update(
    id: string,
    dto: UpdateProductionStageDto,
  ): Promise<ProductionStageDto> {
    const [stage] = await withConflictMapping(
      this.db
        .update(productionStages)
        .set(dto)
        .where(eq(productionStages.id, id))
        .returning(),
      { unique: DUPLICATE_CODE },
    );

    if (!stage) {
      throw new NotFoundException('Production stage not found');
    }

    return stage;
  }

  async delete(id: string): Promise<void> {
    const deleted = await withConflictMapping(
      this.db
        .delete(productionStages)
        .where(eq(productionStages.id, id))
        .returning({ id: productionStages.id }),
      {
        inUse:
          'The stage is used by order production steps; deactivate it instead',
      },
    );

    if (!deleted.length) {
      throw new NotFoundException('Production stage not found');
    }
  }
}
