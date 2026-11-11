import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import { printSettings } from '../../integrations/database/database.schema';
import { printPriced, refreshPriceFrom } from '../catalog/product.pricing';
import type { PrintSettingsDto } from './dto/print.settings.dto';
import { mergePrintSettings } from './print.settings';
import type { PrintSettings } from './print.settings';

const SETTINGS_ID = 'default';

@Injectable()
export class PrintSettingsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async get(executor: DatabaseExecutor = this.db): Promise<PrintSettings> {
    const [row] = await executor
      .select({ settings: printSettings.settings })
      .from(printSettings)
      .where(eq(printSettings.id, SETTINGS_ID));

    return mergePrintSettings(row?.settings);
  }

  async update(dto: PrintSettingsDto): Promise<PrintSettings> {
    if (dto.price.productionDaysMin > dto.price.productionDaysMax) {
      throw new BadRequestException(
        'productionDaysMin must not exceed productionDaysMax',
      );
    }

    const settings: PrintSettings = { ...dto, bases: dto.bases ?? [] };
    const codes = settings.bases.map((base) => base.code);

    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('Base codes must be unique');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .insert(printSettings)
        .values({ id: SETTINGS_ID, settings })
        .onConflictDoUpdate({
          target: printSettings.id,
          set: { settings },
        });
      await refreshPriceFrom(tx, printPriced);
    });
    return this.get();
  }
}
