import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import {
  marketRates,
  metals,
  optionGroups,
  optionValues,
  pricingSettings,
  products,
  productStones,
} from '../../integrations/database/database.schema';
import type { Metal } from '../../integrations/database/database.schema';
import { NbuService } from '../../integrations/nbu/nbu.service';
import {
  printPriced,
  productsWithMetal,
  refreshPriceFrom,
} from '../catalog/product.pricing';
import { marginalPricePerGram } from './pricing.engine';
import { mergeSettings, metalQuote } from './pricing.market';
import { RATE_CODES } from './pricing.settings';
import type { PricingSettings } from './pricing.settings';
import { planProductPrices } from './product.price.plan';
import type { PlanMetal } from './product.price.plan';
import { readUsdRate } from './usd.rate';

export const SETTINGS_ID = 'default';

export interface PricingContext {
  settings: PricingSettings;
  /** Effective rates by code: the manual rate, else the market rate. */
  rates: Map<string, number>;
  usdRate: number;
  metals: Map<string, PlanMetal & { row: Metal }>;
}

const autoPriced = sql`${products.pricing}->>'mode' = 'auto'`;

/**
 * Keeps auto-priced products and auto-synced metal prices in line with the
 * pricing settings and market rates.
 */
@Injectable()
export class ProductPricingService {
  private readonly logger = new Logger(ProductPricingService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly nbu: NbuService,
  ) {}

  /** UAH per USD: the manual rate, else the NBU rate, else the settings rate. */
  usdRate(executor: DatabaseExecutor = this.db): Promise<number> {
    return readUsdRate(executor);
  }

  async context(executor: DatabaseExecutor = this.db): Promise<PricingContext> {
    const [settingsRow, rateRows, metalRows] = await Promise.all([
      executor
        .select({ settings: pricingSettings.settings })
        .from(pricingSettings)
        .where(eq(pricingSettings.id, SETTINGS_ID)),
      executor.select().from(marketRates),
      executor.select().from(metals).orderBy(asc(metals.sortOrder)),
    ]);
    const settings = mergeSettings(settingsRow[0]?.settings);
    const rates = new Map<string, number>();

    for (const row of rateRows) {
      const rate = row.manualRate ?? row.marketRate;

      if (rate != null && rate > 0) {
        rates.set(row.code, rate);
      }
    }

    return {
      settings,
      rates,
      usdRate: rates.get('USD') ?? settings.usdRate,
      metals: new Map(
        metalRows.map((row) => [
          row.id,
          {
            id: row.id,
            name: row.name,
            pricePerGram: row.pricePerGram,
            quote: metalQuote(row, rates),
            row,
          },
        ]),
      ),
    };
  }

  /**
   * Recalculates the stored prices of the matching auto-priced products:
   * the manufacturing price, stone prices, and metal surcharges. Callers
   * refresh `price_from` afterwards.
   */
  async applyAutoPricing(
    tx: DatabaseExecutor,
    where: SQL | undefined,
    context?: PricingContext,
  ): Promise<void> {
    const rows = await tx.query.products.findMany({
      where: and(where, autoPriced),
      columns: { id: true, basePrice: true, weightGrams: true, pricing: true },
      with: {
        stones: { orderBy: [asc(productStones.sortOrder)] },
        optionGroups: {
          orderBy: [asc(optionGroups.sortOrder), asc(optionGroups.createdAt)],
          with: {
            values: {
              orderBy: [
                asc(optionValues.sortOrder),
                asc(optionValues.createdAt),
              ],
            },
          },
        },
      },
    });

    if (!rows.length) {
      return;
    }

    const ctx = context ?? (await this.context(tx));

    for (const row of rows) {
      const plan = planProductPrices(
        {
          pricing: row.pricing!,
          weightGrams: row.weightGrams,
          stones: row.stones,
          optionGroups: row.optionGroups,
          metals: ctx.metals,
          usdRate: ctx.usdRate,
        },
        ctx.settings,
      );

      if (plan.basePrice !== row.basePrice) {
        await tx
          .update(products)
          .set({ basePrice: plan.basePrice })
          .where(eq(products.id, row.id));
      }

      for (const [index, stone] of row.stones.entries()) {
        if (plan.stoneUnitPrices[index] !== stone.unitPrice) {
          await tx
            .update(productStones)
            .set({ unitPrice: plan.stoneUnitPrices[index] })
            .where(eq(productStones.id, stone.id));
        }
      }

      const metalGroup = row.optionGroups.find((g) => g.kind === 'metal');

      for (const variant of plan.variants) {
        const value =
          variant.valueIndex === null
            ? undefined
            : metalGroup?.values[variant.valueIndex];

        if (value && value.priceDelta !== variant.priceDelta) {
          await tx
            .update(optionValues)
            .set({ priceDelta: variant.priceDelta })
            .where(eq(optionValues.id, value.id));
        }
      }

      for (const price of plan.optionPrices) {
        const value =
          row.optionGroups[price.groupIndex]?.values[price.valueIndex];

        if (value && value.priceDelta !== price.priceDelta) {
          await tx
            .update(optionValues)
            .set({ priceDelta: price.priceDelta })
            .where(eq(optionValues.id, value.id));
        }
      }
    }
  }

  /** Reprices the matching auto-priced products and refreshes card prices. */
  async refreshPrices(tx: DatabaseExecutor, where: SQL): Promise<void> {
    await this.applyAutoPricing(tx, where);
    await refreshPriceFrom(tx, where);
  }

  /**
   * Applies the calculated price per gram to metals with automatic sync and
   * a market price. Returns the ids of changed metals.
   */
  async syncMetalPrices(
    tx: DatabaseExecutor,
    ctx: PricingContext,
  ): Promise<string[]> {
    const changed: string[] = [];

    for (const metal of ctx.metals.values()) {
      if (
        !metal.quote.profile.autoPricePerGram ||
        metal.quote.purePricePerGram <= 0
      ) {
        continue;
      }

      const price = marginalPricePerGram(metal.quote, ctx.settings);

      if (price > 0 && price !== metal.pricePerGram) {
        await tx
          .update(metals)
          .set({ pricePerGram: price })
          .where(eq(metals.id, metal.id));
        metal.pricePerGram = price;
        changed.push(metal.id);
      }
    }

    return changed;
  }

  /** Syncs metal prices and reprices every auto-priced product. */
  async repriceAll(tx: DatabaseExecutor): Promise<void> {
    const ctx = await this.context(tx);
    const changed = await this.syncMetalPrices(tx, ctx);
    await this.applyAutoPricing(tx, undefined, ctx);
    await refreshPriceFrom(tx, autoPriced);
    await refreshPriceFrom(tx, printPriced);

    for (const metalId of changed) {
      await refreshPriceFrom(tx, productsWithMetal(tx, metalId));
    }
  }

  /** Stores the latest NBU rates. */
  async fetchMarketRates(tx: DatabaseExecutor): Promise<void> {
    const rates = await this.nbu.exchangeRates(RATE_CODES);
    const fetchedAt = new Date();

    for (const rate of rates) {
      const values = {
        marketRate: rate.rate,
        rateDate: rate.date,
        source: 'nbu',
        fetchedAt,
      };
      await tx
        .insert(marketRates)
        .values({ code: rate.code, ...values })
        .onConflictDoUpdate({ target: marketRates.code, set: values });
    }
  }

  @Cron('0 6 * * *', { name: 'market-rates', timeZone: 'Europe/Kyiv' })
  async refreshDaily(): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        await this.fetchMarketRates(tx);
        await this.repriceAll(tx);
      });
      this.logger.log('Market rates refreshed and products repriced');
    } catch (error) {
      this.logger.error('Market rate refresh failed', error);
    }
  }
}
