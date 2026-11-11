import { BadRequestException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../integrations/database/database.client';
import { printFiles } from '../../integrations/database/database.schema';
import type {
  LabSpecification,
  SelectedOption,
} from '../../integrations/database/database.schema';
import { defaultGroupName, valueLabel } from '../catalog/product.labels';
import { deliversPrint } from '../orders/order.modeling';
import { loadPrintContext } from '../prints/print.context';
import type { LabSpecificationInputDto } from './custom.request.dto';

/**
 * Normalizes a Gripr Lab model specification: the resin must exist (and be
 * active for customers), the base must be one of the print settings, and the
 * source file must be the customer's own model file. Names are snapshotted
 * and print fields are cleared when only the file is delivered.
 */
export async function resolveLabSpecification(
  executor: DatabaseExecutor,
  dto: LabSpecificationInputDto,
  { customerId, activeOnly }: { customerId: string; activeOnly: boolean },
): Promise<LabSpecification> {
  const printed = deliversPrint(dto.deliverable);
  const [ctx, [file]] = await Promise.all([
    loadPrintContext(executor),
    dto.sourceFileId
      ? executor
          .select({ id: printFiles.id, name: printFiles.fileName })
          .from(printFiles)
          .where(
            and(
              eq(printFiles.id, dto.sourceFileId),
              eq(printFiles.customerId, customerId),
            ),
          )
      : [],
  ]);

  if (dto.sourceFileId && !file) {
    throw new BadRequestException('Unknown model file');
  }

  const resin = printed && dto.resinId ? ctx.resins.get(dto.resinId) : null;

  if (resin === undefined || (resin && activeOnly && !resin.isActive)) {
    throw new BadRequestException('The resin is not available');
  }

  const base =
    printed && dto.baseCode
      ? ctx.settings.bases.find((option) => option.code === dto.baseCode)
      : null;

  if (base === undefined) {
    throw new BadRequestException(`Unknown base "${dto.baseCode}"`);
  }

  return {
    deliverable: dto.deliverable,
    heightMm: dto.heightMm ?? null,
    resin: resin ? { id: resin.id, name: resin.name } : null,
    finish: printed ? (dto.finish ?? null) : null,
    painted: printed ? (dto.painted ?? false) : false,
    base: base ? { code: base.code, name: base.name } : null,
    quantity: printed ? (dto.quantity ?? 1) : 1,
    sourceFile: file ?? null,
    comments: dto.comments?.trim() || null,
  };
}

/** Order item options of the print of a Gripr Lab model. */
export function labPrintOptions(spec: LabSpecification): SelectedOption[] {
  const option = (
    kind: 'scale' | 'resin' | 'finish' | 'painting' | 'base' | 'custom',
    label: string | null,
    groupName = defaultGroupName(kind, 'miniature'),
  ): SelectedOption[] =>
    label
      ? [
          {
            groupId: kind,
            groupName,
            kind,
            valueId: kind,
            label,
            priceDelta: 0,
          },
        ]
      : [];

  return [
    ...option('scale', valueLabel('scale', 'miniature', spec, {})),
    ...option('resin', spec.resin?.name ?? null),
    ...option(
      'finish',
      valueLabel('finish', 'miniature', { printFinish: spec.finish }, {}),
    ),
    ...option('painting', spec.painted ? 'Так' : null),
    ...option('base', spec.base?.name ?? null),
    ...option('custom', `${spec.quantity} шт.`, 'Кількість'),
  ];
}
