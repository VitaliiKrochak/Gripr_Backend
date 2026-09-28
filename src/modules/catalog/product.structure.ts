import { BadRequestException } from '@nestjs/common';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../integrations/database/database.client';
import {
  finishingOptions,
  FINISHING_KINDS,
  gemstones,
  metals,
  optionGroups,
  optionValues,
  productImages,
  products,
  productStones,
} from '../../integrations/database/database.schema';
import type {
  FinishingKind,
  ProductType,
} from '../../integrations/database/database.schema';
import type {
  ProductImageInputDto,
  ProductOptionGroupInputDto,
  ProductStoneInputDto,
} from './dto/product.dto';
import { defaultGroupName, valueLabel } from './product.labels';

export interface ProductStructureInput {
  stones?: ProductStoneInputDto[];
  optionGroups?: ProductOptionGroupInputDto[];
  images?: ProductImageInputDto[];
}

type ChildTable =
  | typeof optionGroups
  | typeof optionValues
  | typeof productStones
  | typeof productImages;

/**
 * Replaces the stones, option groups, and images of a product with the given
 * lists. Omitted lists are left unchanged.
 */
export async function saveProductStructure(
  tx: DatabaseExecutor,
  productId: string,
  type: ProductType,
  input: ProductStructureInput,
): Promise<void> {
  if (input.stones) {
    await saveStones(tx, productId, input.stones);
  }

  if (input.optionGroups) {
    await saveOptionGroups(tx, productId, type, input.optionGroups);
  }

  if (input.images) {
    await saveImages(tx, productId, input.images);
  }
}

async function saveStones(
  tx: DatabaseExecutor,
  productId: string,
  stones: ProductStoneInputDto[],
): Promise<void> {
  const current = await idsOf(
    tx
      .select({ id: productStones.id })
      .from(productStones)
      .where(eq(productStones.productId, productId)),
  );
  await assertNewIds(tx, productStones, current, stones);
  const kept: string[] = [];

  for (const [index, stone] of stones.entries()) {
    const row = {
      productId,
      gemstoneId: stone.gemstoneId,
      variation: stone.variation?.trim() || null,
      sizeMm: stone.sizeMm ?? null,
      carat: stone.carat ?? null,
      quantity: stone.quantity,
      unitPrice: stone.unitPrice,
      sortOrder: index,
    };
    kept.push(await upsert(tx, productStones, current, stone.id, row));
  }

  await tx
    .delete(productStones)
    .where(
      and(
        eq(productStones.productId, productId),
        kept.length ? notInArray(productStones.id, kept) : undefined,
      ),
    );
}

async function saveOptionGroups(
  tx: DatabaseExecutor,
  productId: string,
  type: ProductType,
  groups: ProductOptionGroupInputDto[],
): Promise<void> {
  const currentGroups = await idsOf(
    tx
      .select({ id: optionGroups.id })
      .from(optionGroups)
      .where(eq(optionGroups.productId, productId)),
  );
  const currentValues = await idsOf(
    tx
      .select({ id: optionValues.id })
      .from(optionValues)
      .innerJoin(optionGroups, eq(optionGroups.id, optionValues.groupId))
      .where(eq(optionGroups.productId, productId)),
  );
  const values = groups.flatMap((group) => group.values);
  await assertNewIds(tx, optionGroups, currentGroups, groups);
  await assertNewIds(tx, optionValues, currentValues, values);
  const refs = await loadReferences(tx, values);
  const keptGroups: string[] = [];
  const keptValues: string[] = [];

  for (const [groupIndex, group] of groups.entries()) {
    const name = group.name?.trim() || defaultGroupName(group.kind, type);
    const groupId = await upsert(tx, optionGroups, currentGroups, group.id, {
      productId,
      kind: group.kind,
      name,
      isRequired: group.isRequired ?? false,
      sortOrder: groupIndex,
    });
    keptGroups.push(groupId);
    let hasDefault = false;

    for (const [valueIndex, value] of group.values.entries()) {
      const metal = value.metalId ? refs.metals.get(value.metalId) : null;
      const gemstone = value.gemstoneId
        ? refs.gemstones.get(value.gemstoneId)
        : null;
      const finishing = value.finishingId
        ? refs.finishing.get(value.finishingId)
        : null;

      if (
        finishing &&
        (FINISHING_KINDS as readonly string[]).includes(group.kind) &&
        finishing.kind !== (group.kind as FinishingKind)
      ) {
        throw new BadRequestException(
          `"${finishing.name}" cannot be used in the "${name}" group`,
        );
      }

      const label = valueLabel(group.kind, type, value, {
        metal,
        gemstone,
        finishing,
      });

      if (!label) {
        throw new BadRequestException(
          `Option ${valueIndex + 1} in "${name}" needs a name`,
        );
      }

      const isDefault: boolean = value.isDefault === true && !hasDefault;
      hasDefault = hasDefault || isDefault;
      keptValues.push(
        await upsert(tx, optionValues, currentValues, value.id, {
          groupId,
          label,
          metalId: value.metalId ?? null,
          gemstoneId: value.gemstoneId ?? null,
          finishingId: value.finishingId ?? null,
          stoneCarat: value.stoneCarat ?? null,
          stoneSizeMm: value.stoneSizeMm ?? null,
          sizeValue: value.sizeValue ?? null,
          weightDeltaGrams: value.weightDeltaGrams ?? 0,
          priceDelta: value.priceDelta ?? 0,
          productionDaysDelta: value.productionDaysDelta ?? 0,
          isDefault,
          isAvailable: value.isAvailable ?? true,
          sortOrder: valueIndex,
        }),
      );
    }
  }

  const staleValues = [...currentValues].filter(
    (id) => !keptValues.includes(id),
  );

  if (staleValues.length) {
    await tx.delete(optionValues).where(inArray(optionValues.id, staleValues));
  }

  await tx
    .delete(optionGroups)
    .where(
      and(
        eq(optionGroups.productId, productId),
        keptGroups.length ? notInArray(optionGroups.id, keptGroups) : undefined,
      ),
    );
}

async function saveImages(
  tx: DatabaseExecutor,
  productId: string,
  images: ProductImageInputDto[],
): Promise<void> {
  const current = await idsOf(
    tx
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, productId)),
  );
  await assertNewIds(tx, productImages, current, images);
  const linked = images.flatMap((image) => image.optionValueId ?? []);
  const ownValues = linked.length
    ? await idsOf(
        tx
          .select({ id: optionValues.id })
          .from(optionValues)
          .innerJoin(optionGroups, eq(optionGroups.id, optionValues.groupId))
          .where(
            and(
              eq(optionGroups.productId, productId),
              inArray(optionValues.id, linked),
            ),
          ),
      )
    : new Set<string>();

  if (linked.some((id) => !ownValues.has(id))) {
    throw new BadRequestException(
      'optionValueId does not belong to this product',
    );
  }

  const kept: string[] = [];

  for (const [index, image] of images.entries()) {
    kept.push(
      await upsert(tx, productImages, current, image.id, {
        productId,
        publicId: image.publicId,
        url: image.url,
        alt: image.alt?.trim() || null,
        optionValueId: image.optionValueId ?? null,
        sortOrder: index,
      }),
    );
  }

  await tx
    .delete(productImages)
    .where(
      and(
        eq(productImages.productId, productId),
        kept.length ? notInArray(productImages.id, kept) : undefined,
      ),
    );
}

async function idsOf(query: Promise<Array<{ id: string }>>) {
  return new Set((await query).map((row) => row.id));
}

/** Client-generated ids must be unique and unused by other products. */
async function assertNewIds(
  tx: DatabaseExecutor,
  table: ChildTable,
  current: Set<string>,
  items: Array<{ id?: string }>,
): Promise<void> {
  const ids = items.flatMap((item) => item.id ?? []);

  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException('Each row id must be unique');
  }

  const fresh = ids.filter((id) => !current.has(id));

  if (!fresh.length) {
    return;
  }

  const taken = await tx
    .select({ id: table.id })
    .from(table)
    .where(inArray(table.id, fresh));

  if (taken.length) {
    throw new BadRequestException(
      `Row ${taken[0].id} belongs to another product`,
    );
  }
}

async function upsert<T extends ChildTable>(
  tx: DatabaseExecutor,
  table: T,
  current: Set<string>,
  id: string | undefined,
  values: T['$inferInsert'],
): Promise<string> {
  if (id && current.has(id)) {
    await tx
      .update(table)
      .set(values as never)
      .where(eq(table.id, id));
    return id;
  }

  const [row] = await tx
    .insert(table)
    .values({ ...values, ...(id ? { id } : {}) } as never)
    .returning({ id: table.id });
  return row.id;
}

async function loadReferences(
  tx: DatabaseExecutor,
  values: ProductOptionGroupInputDto['values'],
) {
  const metalIds = values.flatMap((value) => value.metalId ?? []);
  const gemstoneIds = values.flatMap((value) => value.gemstoneId ?? []);
  const finishingIds = values.flatMap((value) => value.finishingId ?? []);
  const [metalRows, gemstoneRows, finishingRows] = await Promise.all([
    tx
      .select({ id: metals.id, name: metals.name })
      .from(metals)
      .where(inArray(metals.id, metalIds)),
    tx
      .select({ id: gemstones.id, name: gemstones.name })
      .from(gemstones)
      .where(inArray(gemstones.id, gemstoneIds)),
    tx
      .select({
        id: finishingOptions.id,
        name: finishingOptions.name,
        kind: finishingOptions.kind,
      })
      .from(finishingOptions)
      .where(inArray(finishingOptions.id, finishingIds)),
  ]);
  const refs = {
    metals: new Map(metalRows.map((row) => [row.id, row])),
    gemstones: new Map(gemstoneRows.map((row) => [row.id, row])),
    finishing: new Map(finishingRows.map((row) => [row.id, row])),
  };

  if (
    metalIds.some((id) => !refs.metals.has(id)) ||
    gemstoneIds.some((id) => !refs.gemstones.has(id)) ||
    finishingIds.some((id) => !refs.finishing.has(id))
  ) {
    throw new BadRequestException(
      'Referenced metal, gemstone, or operation does not exist',
    );
  }

  return refs;
}

/** Keeps `products.updated_at` meaningful when only children changed. */
export function touchProduct(tx: DatabaseExecutor, productId: string) {
  return tx
    .update(products)
    .set({ updatedAt: new Date() })
    .where(eq(products.id, productId));
}
