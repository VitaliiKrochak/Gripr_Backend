import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  combinations,
  ConfigurationError,
  priceFrom,
} from '../catalog/product.configuration';
import type {
  ConfigurableGroup,
  ConfigurableValue,
} from '../catalog/product.configuration';
import { defaultGroupName, valueLabel } from '../catalog/product.labels';
import { printFields } from '../catalog/product.structure';
import type {
  PrintCalculateRequestDto,
  PrintCalculateResultDto,
  PrintCombinationDto,
  PrintProductPreviewDto,
  PrintProductPreviewRequestDto,
} from './dto/print.pricing.dto';
import {
  calculateSelection,
  DEFAULT_PRINT_FINISH,
  loadPrintContext,
  toProductPrint,
  withPrintPricing,
} from './print.context';
import type { PrintContext } from './print.context';
import { calculatePrint, printScale } from './print.pricing';

/** Combinations listed by the product preview. */
const MAX_PREVIEW_COMBINATIONS = 500;

@Injectable()
export class PrintPricingService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Prices one-off pieces, e.g. a customer's model. */
  async calculate(
    dto: PrintCalculateRequestDto,
  ): Promise<PrintCalculateResultDto> {
    const ctx = await this.context(dto.printerId);
    const resin = dto.resinId ? ctx.resins.get(dto.resinId) : ctx.defaultResin;

    if (!resin) {
      throw new BadRequestException(
        dto.resinId ? 'Resin not found' : 'Set a default resin first',
      );
    }

    const print = toProductPrint({ mode: 'auto', ...dto });
    const calculation = calculatePrint(
      {
        model: print,
        scale: printScale(print, dto),
        resin,
        finish: dto.finish ?? DEFAULT_PRINT_FINISH,
        paintingMultiplier: dto.paintingMultiplier ?? 1,
        extras: dto.extras ?? 0,
        overrides: print.overrides,
      },
      ctx.printer!,
      ctx.settings,
    );
    const quantity = dto.quantity ?? 1;

    return {
      printer: { id: ctx.printer!.id, name: ctx.printer!.name },
      resin: { id: resin.id, name: resin.name },
      usdRate: ctx.usdRate,
      calculation,
      quantity,
      total: calculation.unitPrice * quantity,
      productionDaysMin: ctx.settings.price.productionDaysMin,
      productionDaysMax: ctx.settings.price.productionDaysMax,
    };
  }

  /** Prices every combination of an unsaved Lab product for the editor. */
  async previewProduct(
    dto: PrintProductPreviewRequestDto,
  ): Promise<PrintProductPreviewDto> {
    const ctx = await this.context(dto.printerId);
    const print = toProductPrint({ ...dto.print, mode: 'auto' });
    const groups: ConfigurableGroup[] = dto.optionGroups.map(
      (group, groupIndex) => ({
        id: `group-${groupIndex}`,
        name: group.name?.trim() || defaultGroupName(group.kind, 'other_print'),
        kind: group.kind,
        isRequired: group.isRequired ?? false,
        values: group.values.map((value, valueIndex): ConfigurableValue => {
          const fields = printFields(group.kind, value);
          const resin = fields.resinId ? ctx.resins.get(fields.resinId) : null;

          if (fields.resinId && !resin) {
            throw new BadRequestException('Referenced resin does not exist');
          }

          return {
            id: `${groupIndex}:${valueIndex}`,
            label:
              valueLabel(
                group.kind,
                'other_print',
                { ...value, ...fields },
                { resin },
              ) ?? `${valueIndex + 1}`,
            priceDelta: value.priceDelta ?? 0,
            productionDaysDelta: 0,
            isDefault: false,
            isAvailable: value.isAvailable ?? true,
            ...fields,
          };
        }),
      }),
    );
    const choices = groups.map((group) => {
      const available = group.values.filter((value) => value.isAvailable);
      return group.isRequired ? available : [null, ...available];
    });
    const total = choices.reduce((count, list) => count * list.length, 1);
    const listed: PrintCombinationDto[] = [];

    for (const selection of combinations(choices)) {
      if (listed.length >= MAX_PREVIEW_COMBINATIONS) {
        break;
      }

      const selected = selection.filter(
        (value): value is ConfigurableValue => value !== null,
      );
      listed.push({
        choices: selected.map((value) => {
          const [groupIndex, valueIndex] = value.id.split(':').map(Number);
          return { groupIndex, valueIndex, label: value.label };
        }),
        ...this.tryCalculate(print, selected, ctx),
      });
    }

    return {
      printer: { id: ctx.printer!.id, name: ctx.printer!.name },
      usdRate: ctx.usdRate,
      priceFrom: priceFrom(
        withPrintPricing(
          {
            basePrice: 0,
            productionDaysMin: 0,
            productionDaysMax: 0,
            optionGroups: groups,
            print,
          },
          ctx,
        ),
      ),
      productionDaysMin: ctx.settings.price.productionDaysMin,
      productionDaysMax: ctx.settings.price.productionDaysMax,
      combinations: listed,
      truncated: total > listed.length,
    };
  }

  private tryCalculate(
    print: ReturnType<typeof toProductPrint>,
    selected: ConfigurableValue[],
    ctx: PrintContext,
  ): Pick<PrintCombinationDto, 'calculation' | 'error'> {
    try {
      return {
        calculation: calculateSelection(print, selected, ctx),
        error: null,
      };
    } catch (error) {
      if (error instanceof ConfigurationError) {
        return { calculation: null, error: error.message };
      }

      throw error;
    }
  }

  private async context(printerId?: string): Promise<PrintContext> {
    const ctx = await loadPrintContext(this.db, printerId);

    if (!ctx.printer) {
      if (printerId) {
        throw new NotFoundException('Printer not found');
      }

      throw new BadRequestException('Add a printer first');
    }

    return ctx;
  }
}
