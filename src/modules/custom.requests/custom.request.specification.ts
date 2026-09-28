import { BadRequestException } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../integrations/database/database.client';
import {
  finishingOptions,
  gemstones,
  metals,
} from '../../integrations/database/database.schema';
import type {
  FinishingKind,
  JewelrySpecification,
  SpecificationChoice,
} from '../../integrations/database/database.schema';
import type {
  JewelrySpecificationDto,
  SpecificationChoiceDto,
} from '../../shared/specification/jewelry.specification.dto';
import { sizeSystemOf } from '../catalog/product.types';

const text = (value: string | null | undefined): string | null =>
  value?.trim() || null;

/**
 * Normalizes a submitted specification: referenced metals, stones, and
 * operations must exist (and be active for customers), their names are
 * snapshotted, and fields that contradict the chosen modes are cleared.
 */
export async function resolveSpecification(
  db: DatabaseExecutor,
  dto: JewelrySpecificationDto,
  { activeOnly }: { activeOnly: boolean },
): Promise<JewelrySpecification> {
  const stones = dto.stoneMode === 'specified' ? dto.stones : [];

  if (dto.stoneMode === 'specified' && !stones.length) {
    throw new BadRequestException('Add at least one stone or choose no stones');
  }

  if (dto.metalMode === 'specified' && !dto.metal) {
    throw new BadRequestException('Choose a metal or ask for a recommendation');
  }

  const metalIds =
    dto.metalMode === 'specified' && dto.metal?.id ? [dto.metal.id] : [];
  const gemstoneIds = stones.flatMap((stone) => stone.gemstoneId ?? []);
  const finishing = [
    ...(dto.engraving?.id ? [{ id: dto.engraving.id, kind: 'engraving' }] : []),
    ...(dto.coating?.id ? [{ id: dto.coating.id, kind: 'coating' }] : []),
    ...(dto.processing ?? []).flatMap((item) =>
      item.id ? [{ id: item.id, kind: 'processing' }] : [],
    ),
  ] as Array<{ id: string; kind: FinishingKind }>;

  const [metalRows, gemstoneRows, finishingRows] = await Promise.all([
    db
      .select({ id: metals.id, name: metals.name })
      .from(metals)
      .where(
        and(
          inArray(metals.id, metalIds),
          activeOnly ? eq(metals.isActive, true) : undefined,
        ),
      ),
    db
      .select({ id: gemstones.id, name: gemstones.name })
      .from(gemstones)
      .where(
        and(
          inArray(gemstones.id, gemstoneIds),
          activeOnly ? eq(gemstones.isActive, true) : undefined,
        ),
      ),
    db
      .select({
        id: finishingOptions.id,
        name: finishingOptions.name,
        kind: finishingOptions.kind,
      })
      .from(finishingOptions)
      .where(
        and(
          inArray(
            finishingOptions.id,
            finishing.map((item) => item.id),
          ),
          activeOnly ? eq(finishingOptions.isActive, true) : undefined,
        ),
      ),
  ]);
  const metalNames = new Map(metalRows.map((row) => [row.id, row.name]));
  const gemstoneNames = new Map(gemstoneRows.map((row) => [row.id, row.name]));
  const finishingById = new Map(finishingRows.map((row) => [row.id, row]));

  if (
    metalIds.some((id) => !metalNames.has(id)) ||
    gemstoneIds.some((id) => !gemstoneNames.has(id)) ||
    finishing.some((item) => finishingById.get(item.id)?.kind !== item.kind)
  ) {
    throw new BadRequestException(
      'Selected metal, stone, or operation is not available',
    );
  }

  const finishingNames = new Map(
    finishingRows.map((row) => [row.id, row.name]),
  );
  const choice =
    (names: Map<string, string>) =>
    (value: SpecificationChoiceDto): SpecificationChoice => ({
      id: value.id ?? null,
      name: value.id ? names.get(value.id)! : value.name.trim(),
    });
  const finishingChoice = choice(finishingNames);
  const engravingText = text(dto.engraving?.text);

  return {
    productType: dto.productType,
    metalMode: dto.metalMode,
    metal:
      dto.metalMode === 'specified' && dto.metal
        ? choice(metalNames)(dto.metal)
        : null,
    weightGrams: dto.weightGrams ?? null,
    size: sizeSystemOf(dto.productType) === 'none' ? null : (dto.size ?? null),
    stoneMode: dto.stoneMode,
    stones: stones.map((stone) => ({
      gemstoneId: stone.gemstoneId ?? null,
      name: stone.gemstoneId
        ? gemstoneNames.get(stone.gemstoneId)!
        : stone.name.trim(),
      sizeMm: stone.sizeMm ?? null,
      quantity: stone.quantity,
      notes: text(stone.notes),
    })),
    engraving: dto.engraving
      ? { ...finishingChoice(dto.engraving), text: engravingText }
      : null,
    coating: dto.coating ? finishingChoice(dto.coating) : null,
    processing: (dto.processing ?? []).map(finishingChoice),
    timeline: text(dto.timeline),
    comments: text(dto.comments),
    requirements: text(dto.requirements),
    extras: (dto.extras ?? [])
      .map((extra) => ({
        label: extra.label.trim(),
        value: extra.value.trim(),
      }))
      .filter((extra) => extra.label && extra.value),
  };
}
