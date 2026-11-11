import { and, asc, eq, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../integrations/database/database.client';
import {
  printRequestItems,
  printRequests,
  resins,
} from '../../integrations/database/database.schema';
import type {
  PrintRequestItem,
  SelectedOption,
} from '../../integrations/database/database.schema';
import { defaultGroupName, valueLabel } from '../catalog/product.labels';
import { isPriceExpired, priceValidUntil } from './print.request.status';

/** One model of a confirmed print request in the Lab cart. */
export interface CartPrintItem {
  id: string;
  fileName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  selectedOptions: SelectedOption[];
}

/** A confirmed print request in the Lab cart; it is ordered as a whole. */
export interface CartPrint {
  requestId: string;
  items: CartPrintItem[];
  total: number;
  productionDaysMin: number;
  productionDaysMax: number;
  priceValidUntil: Date | null;
  unavailableReason: string | null;
}

/**
 * The customer's print requests in the cart. A request whose confirmed price
 * expired stays in the result with `unavailableReason`.
 */
export async function loadCartPrints(
  executor: DatabaseExecutor,
  customerId: string,
  { lock = false, now = new Date() } = {},
): Promise<CartPrint[]> {
  const query = executor
    .select()
    .from(printRequests)
    .where(
      and(
        eq(printRequests.customerId, customerId),
        eq(printRequests.status, 'in_cart'),
      ),
    )
    .orderBy(asc(printRequests.updatedAt));
  const requests = await (lock ? query.for('update') : query);

  if (!requests.length) return [];

  const items = await executor
    .select()
    .from(printRequestItems)
    .where(
      inArray(
        printRequestItems.requestId,
        requests.map((request) => request.id),
      ),
    )
    .orderBy(asc(printRequestItems.position));
  const resinIds = [...new Set(items.flatMap((item) => item.resinId ?? []))];
  const resinNames = new Map(
    (resinIds.length
      ? await executor
          .select({ id: resins.id, name: resins.name })
          .from(resins)
          .where(inArray(resins.id, resinIds))
      : []
    ).map((resin) => [resin.id, resin.name]),
  );

  return requests.map((request) => {
    const own = items.filter((item) => item.requestId === request.id);

    return {
      requestId: request.id,
      items: own.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? 0,
        lineTotal: item.lineTotal ?? 0,
        selectedOptions: printSelectedOptions(item, resinNames),
      })),
      total: request.confirmedPrice ?? 0,
      productionDaysMin: request.productionDaysMin ?? 0,
      productionDaysMax: request.productionDaysMax ?? 0,
      priceValidUntil: priceValidUntil(request.confirmedAt),
      unavailableReason:
        request.confirmedPrice === null ||
        isPriceExpired(request.confirmedAt, now)
          ? 'The confirmed price expired; the Lab checks it again'
          : null,
    };
  });
}

/** Order lines of the cart prints: one per model. */
export function printOrderItems(orderId: string, prints: CartPrint[]) {
  return prints.flatMap((print) =>
    print.items.map((item) => ({
      orderId,
      itemKind: 'print' as const,
      printRequestId: print.requestId,
      productName: `Друк: ${item.fileName}`,
      selectedOptions: item.selectedOptions,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      productionDaysMin: print.productionDaysMin,
      productionDaysMax: print.productionDaysMax,
    })),
  );
}

export async function markPrintsOrdered(
  executor: DatabaseExecutor,
  requestIds: string[],
  orderId: string,
): Promise<void> {
  if (!requestIds.length) return;

  await executor
    .update(printRequests)
    .set({ status: 'ordered', orderId })
    .where(
      and(
        inArray(printRequests.id, requestIds),
        eq(printRequests.status, 'in_cart'),
      ),
    );
}

/** The order was cancelled: its print requests are cancelled too. */
export async function cancelOrderPrints(
  executor: DatabaseExecutor,
  orderId: string,
): Promise<void> {
  await executor
    .update(printRequests)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(printRequests.orderId, orderId),
        eq(printRequests.status, 'ordered'),
      ),
    );
}

function printSelectedOptions(
  item: PrintRequestItem,
  resinNames: Map<string, string>,
): SelectedOption[] {
  const option = (
    kind: 'scale' | 'resin' | 'finish' | 'painting' | 'base',
    label: string | null,
    priceDelta = 0,
  ): SelectedOption[] =>
    label
      ? [
          {
            groupId: kind,
            groupName: defaultGroupName(kind, 'miniature'),
            kind,
            valueId: item.id,
            label,
            priceDelta,
          },
        ]
      : [];

  return [
    ...option(
      'scale',
      valueLabel('scale', 'miniature', item, {}) ?? 'Розмір файлу',
    ),
    ...option(
      'resin',
      item.resinId ? (resinNames.get(item.resinId) ?? null) : null,
    ),
    ...option(
      'finish',
      valueLabel('finish', 'miniature', { printFinish: item.finish }, {}),
    ),
    ...option('painting', item.painted ? 'З розфарбуванням' : null),
    ...option('base', item.base?.name ?? null),
  ];
}
