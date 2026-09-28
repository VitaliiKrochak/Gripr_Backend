import type {
  OptionGroupKind,
  ProductType,
} from '../../integrations/database/database.schema';
import { formatSize, sizeSystemOf } from './product.types';

const GROUP_NAMES: Record<OptionGroupKind, string> = {
  metal: 'Метал',
  stone: 'Камінь',
  size: 'Розмір',
  engraving: 'Гравіювання',
  coating: 'Покриття',
  processing: 'Обробка',
  custom: 'Опція',
};

/** Configurator heading used when the administrator leaves it empty. */
export function defaultGroupName(
  kind: OptionGroupKind,
  type: ProductType,
): string {
  if (kind === 'size' && sizeSystemOf(type) === 'length') {
    return 'Довжина';
  }

  return GROUP_NAMES[kind];
}

export interface LabelSource {
  label?: string | null;
  sizeValue?: number | null;
  stoneSizeMm?: number | null;
  stoneCarat?: number | null;
}

export interface LabelReferences {
  metal?: { name: string } | null;
  gemstone?: { name: string } | null;
  finishing?: { name: string } | null;
}

/**
 * Customer-facing value label: an explicit label wins, otherwise it is
 * derived from the referenced metal, stone, operation, or size.
 */
export function valueLabel(
  kind: OptionGroupKind,
  type: ProductType,
  value: LabelSource,
  refs: LabelReferences,
): string | null {
  const explicit = value.label?.trim();

  if (explicit) {
    return explicit;
  }

  switch (kind) {
    case 'metal':
      return refs.metal?.name ?? null;
    case 'stone': {
      if (!refs.gemstone) {
        return null;
      }

      const details = [
        value.stoneSizeMm != null ? `${value.stoneSizeMm} мм` : null,
        value.stoneCarat != null ? `${value.stoneCarat} ct` : null,
      ].filter(Boolean);
      return details.length
        ? `${refs.gemstone.name}, ${details.join(', ')}`
        : refs.gemstone.name;
    }
    case 'size':
      return value.sizeValue != null ? formatSize(type, value.sizeValue) : null;
    case 'engraving':
    case 'coating':
    case 'processing':
      return refs.finishing?.name ?? null;
    default:
      return null;
  }
}
