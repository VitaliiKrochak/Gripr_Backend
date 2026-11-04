import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  marketRates,
  metals,
  pricingSettings,
} from '../../integrations/database/database.schema';
import type { MetalFamily } from '../../integrations/database/database.schema';
import { NbuError } from '../../integrations/nbu/nbu.service';
import type { MarketRateDto, SetManualRateDto } from './dto/market.rate.dto';
import type {
  CalculatePriceDto,
  PriceCalculationDto,
  ProductPricePreviewDto,
  ProductPricePreviewRequestDto,
} from './dto/pricing.calculation.dto';
import type { PricingMetalDto } from './dto/pricing.metal.dto';
import type {
  MetalPricingProfileDto,
  PricingSettingsDto,
} from './dto/pricing.settings.dto';
import {
  alloyPricePerGram,
  calculateItem,
  calculateModel,
  castingTariff,
  combineProject,
  marginalPricePerGram,
} from './pricing.engine';
import { purePricePerGram } from './pricing.market';
import { RATE_CODES, SPOT_CODE_BY_FAMILY } from './pricing.settings';
import type { PricingSettings, RateCode } from './pricing.settings';
import { planProductPrices, resolveServices } from './product.price.plan';
import { ProductPricingService, SETTINGS_ID } from './product.pricing.service';
import type { PricingContext } from './product.pricing.service';

const SPOT_FAMILIES = Object.entries(SPOT_CODE_BY_FAMILY) as Array<
  [MetalFamily, string]
>;

@Injectable()
export class PricingService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly productPricing: ProductPricingService,
  ) {}

  async getSettings(): Promise<PricingSettings> {
    return (await this.productPricing.context()).settings;
  }

  async updateSettings(dto: PricingSettingsDto): Promise<PricingSettings> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(pricingSettings)
        .values({ id: SETTINGS_ID, settings: dto })
        .onConflictDoUpdate({
          target: pricingSettings.id,
          set: { settings: dto },
        });
      await this.productPricing.repriceAll(tx);
    });
    return this.getSettings();
  }

  async listMarketRates(): Promise<MarketRateDto[]> {
    const rows = await this.db.select().from(marketRates);
    const byCode = new Map(rows.map((row) => [row.code, row]));

    return RATE_CODES.map((code) => {
      const row = byCode.get(code);
      const effectiveRate = row?.manualRate ?? row?.marketRate ?? null;
      const family = SPOT_FAMILIES.find(([, spot]) => spot === code)?.[0];

      return {
        code,
        marketRate: row?.marketRate ?? null,
        manualRate: row?.manualRate ?? null,
        effectiveRate,
        purePricePerGram:
          family && effectiveRate
            ? purePricePerGram(family, new Map([[code, effectiveRate]]))
            : null,
        rateDate: row?.rateDate ?? null,
        source: row?.source ?? null,
        fetchedAt: row?.fetchedAt ?? null,
      };
    });
  }

  async refreshMarketRates(): Promise<MarketRateDto[]> {
    try {
      await this.db.transaction(async (tx) => {
        await this.productPricing.fetchMarketRates(tx);
        await this.productPricing.repriceAll(tx);
      });
    } catch (error) {
      if (error instanceof NbuError || error instanceof TypeError) {
        throw new BadGatewayException('Could not fetch NBU rates');
      }

      throw error;
    }

    return this.listMarketRates();
  }

  async setManualRate(
    code: RateCode,
    dto: SetManualRateDto,
  ): Promise<MarketRateDto[]> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(marketRates)
        .values({ code, manualRate: dto.manualRate })
        .onConflictDoUpdate({
          target: marketRates.code,
          set: { manualRate: dto.manualRate },
        });
      await this.productPricing.repriceAll(tx);
    });
    return this.listMarketRates();
  }

  async listMetals(): Promise<PricingMetalDto[]> {
    const ctx = await this.productPricing.context();
    return [...ctx.metals.values()].map((metal) => toPricingMetal(metal, ctx));
  }

  async updateMetalProfile(
    id: string,
    profile: MetalPricingProfileDto | null,
  ): Promise<PricingMetalDto> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(metals)
        .set({ pricingProfile: profile })
        .where(eq(metals.id, id))
        .returning({ id: metals.id });

      if (!row) {
        throw new NotFoundException('Metal not found');
      }

      await this.productPricing.repriceAll(tx);
    });

    const ctx = await this.productPricing.context();
    return toPricingMetal(ctx.metals.get(id)!, ctx);
  }

  async calculate(dto: CalculatePriceDto): Promise<PriceCalculationDto> {
    const ctx = await this.productPricing.context();
    const metal = dto.metalId ? ctx.metals.get(dto.metalId) : null;

    if (dto.metalId && !metal) {
      throw new NotFoundException('Metal not found');
    }

    const item = calculateItem(
      {
        metal: metal?.quote ?? null,
        clientMetal: dto.clientMetal,
        weightGrams: dto.weightGrams,
        laborType: dto.laborType,
        laborHours: dto.laborHours,
        jeweler: dto.jeweler,
        setter: dto.setter,
        scenario: dto.scenario ?? ctx.settings.defaultScenario,
        urgency: dto.urgency,
        discount: dto.discount,
        extraProfit: dto.extraProfit,
        delivery: dto.delivery ?? ctx.settings.defaults.delivery,
        packaging: dto.packaging ?? ctx.settings.defaults.packaging,
        consumables: dto.consumables ?? ctx.settings.defaults.consumables,
        services: resolveServices(dto.services, ctx.settings, ctx.usdRate),
        stones: dto.stones,
        fittings: dto.fittings,
        overrides: dto.overrides,
      },
      ctx.settings,
    );
    const model = dto.model ? calculateModel(dto.model, ctx.settings) : null;

    return {
      metal: metal
        ? {
            id: metal.id,
            name: metal.name,
            family: metal.quote.family,
            fineness: metal.quote.fineness,
            purePricePerGram: metal.quote.purePricePerGram,
          }
        : null,
      usdRate: ctx.usdRate,
      item,
      model,
      project: combineProject(item, model),
    };
  }

  async previewProduct(
    dto: ProductPricePreviewRequestDto,
  ): Promise<ProductPricePreviewDto> {
    const ctx = await this.productPricing.context();
    const plan = planProductPrices(
      {
        pricing: dto.pricing,
        weightGrams: dto.weightGrams,
        stones: dto.stones.map((stone) => ({
          quantity: stone.quantity,
          unitPrice: stone.unitPrice,
          purchasePrice: stone.purchasePrice ?? null,
          settingType: stone.settingType ?? null,
          cut: stone.cut ?? null,
          sizeMm: stone.sizeMm ?? null,
          settingCost: stone.settingCost ?? 0,
        })),
        optionGroups: dto.optionGroups.map((group) => ({
          kind: group.kind,
          isRequired: group.isRequired ?? true,
          values: group.values.map((value) => ({
            metalId: value.metalId ?? null,
            weightDeltaGrams: value.weightDeltaGrams ?? 0,
            priceDelta: value.priceDelta ?? 0,
            isDefault: value.isDefault ?? false,
            isAvailable: value.isAvailable ?? true,
            stoneSizeMm: value.stoneSizeMm ?? null,
            stoneQuantity: value.stoneQuantity ?? 1,
            purchasePrice: value.purchasePrice ?? null,
            settingType: value.settingType ?? null,
            cut: value.cut ?? null,
            settingCost: value.settingCost ?? 0,
          })),
        })),
        metals: ctx.metals,
        usdRate: ctx.usdRate,
      },
      ctx.settings,
    );
    return plan;
  }
}

function toPricingMetal(
  metal: PricingContext['metals'] extends Map<string, infer M> ? M : never,
  ctx: PricingContext,
): PricingMetalDto {
  const { row, quote } = metal;
  const casting = castingTariff(quote, ctx.settings);

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    family: row.family,
    purity: row.purity,
    isActive: row.isActive,
    fineness: quote.fineness,
    pricePerGram: metal.pricePerGram,
    profile: quote.profile,
    profileIsDefault: row.pricingProfile == null,
    purePricePerGram: quote.purePricePerGram,
    alloyPricePerGram: alloyPricePerGram(quote),
    castingCostPerGram: casting.cost,
    castingPricePerGram: casting.price,
    suggestedPricePerGram:
      quote.purePricePerGram > 0
        ? marginalPricePerGram(quote, ctx.settings)
        : 0,
  };
}
