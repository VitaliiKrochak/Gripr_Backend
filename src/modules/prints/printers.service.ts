import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ne } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import { printers } from '../../integrations/database/database.schema';
import type { Printer } from '../../integrations/database/database.schema';
import { withConflictMapping } from '../../shared/errors/conflict.mapping';
import { printPriced, refreshPriceFrom } from '../catalog/product.pricing';
import { ProductPricingService } from '../pricing/product.pricing.service';
import type {
  CreatePrinterDto,
  PrinterDto,
  UpdatePrinterDto,
} from './dto/printer.dto';
import { printerCosts } from './printer.costs';

const DUPLICATE_CODE = 'Printer code already exists';

@Injectable()
export class PrintersService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly pricing: ProductPricingService,
  ) {}

  async list(): Promise<PrinterDto[]> {
    const [rows, usdRate] = await Promise.all([
      this.db
        .select()
        .from(printers)
        .orderBy(asc(printers.sortOrder), asc(printers.name)),
      this.pricing.usdRate(),
    ]);

    return rows.map((row) => toDto(row, usdRate));
  }

  async get(id: string): Promise<PrinterDto> {
    const [row] = await this.db
      .select()
      .from(printers)
      .where(eq(printers.id, id));

    if (!row) {
      throw new NotFoundException('Printer not found');
    }

    return toDto(row, await this.pricing.usdRate());
  }

  async create(dto: CreatePrinterDto): Promise<PrinterDto> {
    const id = await withConflictMapping(
      this.db.transaction(async (tx) => {
        const [row] = await tx.insert(printers).values(dto).returning();
        await keepSingleDefault(tx, row);
        await refreshPriceFrom(tx, printPriced);
        return row.id;
      }),
      { unique: DUPLICATE_CODE },
    );
    return this.get(id);
  }

  async update(id: string, dto: UpdatePrinterDto): Promise<PrinterDto> {
    const row = await withConflictMapping(
      this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(printers)
          .set(dto)
          .where(eq(printers.id, id))
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
      throw new NotFoundException('Printer not found');
    }

    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const [row] = await this.db.transaction(async (tx) => {
      const deleted = await tx
        .delete(printers)
        .where(eq(printers.id, id))
        .returning({ id: printers.id });
      await refreshPriceFrom(tx, printPriced);
      return deleted;
    });

    if (!row) {
      throw new NotFoundException('Printer not found');
    }
  }
}

async function keepSingleDefault(
  executor: DatabaseExecutor,
  printer: { id: string; isDefault: boolean },
): Promise<void> {
  if (printer.isDefault) {
    await executor
      .update(printers)
      .set({ isDefault: false })
      .where(and(ne(printers.id, printer.id), eq(printers.isDefault, true)));
  }
}

function toDto(row: Printer, usdRate: number): PrinterDto {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...printer } = row;

  return { ...printer, usdRate, costs: printerCosts(row, usdRate) };
}
