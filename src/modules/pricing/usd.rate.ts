import { eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../integrations/database/database.client';
import {
  marketRates,
  pricingSettings,
} from '../../integrations/database/database.schema';
import { mergeSettings } from './pricing.market';

/** UAH per USD: the manual rate, else the NBU rate, else the settings rate. */
export async function readUsdRate(executor: DatabaseExecutor): Promise<number> {
  const [[rate], [settingsRow]] = await Promise.all([
    executor.select().from(marketRates).where(eq(marketRates.code, 'USD')),
    executor
      .select({ settings: pricingSettings.settings })
      .from(pricingSettings)
      .where(eq(pricingSettings.id, 'default')),
  ]);
  const effective = rate?.manualRate ?? rate?.marketRate;

  return effective != null && effective > 0
    ? effective
    : mergeSettings(settingsRow?.settings).usdRate;
}
