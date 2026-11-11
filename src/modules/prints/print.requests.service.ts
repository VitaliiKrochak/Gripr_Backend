import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { User } from '@supabase/supabase-js';
import { and, asc, count, desc, eq, inArray, lte, ne, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import {
  messages,
  printers,
  printFiles,
  printRequestItems,
  printRequests,
  resins,
} from '../../integrations/database/database.schema';
import type {
  PrintFile,
  PrintRequest,
  PrintRequestItem,
  PrintRequestStatus,
  Resin,
} from '../../integrations/database/database.schema';
import { MODEL_FILE_LIMIT_BYTES } from '../../integrations/supabase/supabase.storage.service';
import { toOffset, toPage } from '../../shared/pagination/pagination';
import type { PaginationQueryDto } from '../../shared/pagination/pagination.query.dto';
import { CustomersService } from '../customers/customers.service';
import {
  MAX_PRINT_QUANTITY,
  MAX_PRINT_REQUEST_ITEMS,
} from './dto/print.request.dto';
import type {
  AdminPrintRequestDto,
  AdminPrintRequestItemDto,
  AdminPrintRequestListQueryDto,
  AdminPrintRequestPageDto,
  AdminUpdatePrintRequestDto,
  CreatePrintRequestDto,
  PrintItemPriceDto,
  PrintOptionsDto,
  PrintQuoteDto,
  PrintQuoteRequestDto,
  PrintRequestDto,
  PrintRequestItemDto,
  PrintRequestItemInputDto,
  PrintRequestPageDto,
  UpdatePrintRequestDto,
} from './dto/print.request.dto';
import { loadPrintContext } from './print.context';
import type { PrintContext } from './print.context';
import { NO_PRINT_OVERRIDES } from './print.pricing';
import type { PrintOverrides } from './print.pricing';
import { priceCustomPrint } from './print.request.pricing';
import type { CustomPrintPrice } from './print.request.pricing';
import {
  canTransitionPrintRequest,
  CUSTOMER_EDITABLE,
  isPriceExpired,
  PRICE_VALID_DAYS,
  priceValidUntil,
  STAFF_REVIEWABLE,
} from './print.request.status';
import { PRINT_FINISHES } from './print.settings';

/** The customer's choices of one item, checked against the catalog. */
type ItemChoices = Pick<
  PrintRequestItem,
  | 'position'
  | 'fileId'
  | 'fileName'
  | 'quantity'
  | 'heightMm'
  | 'scaleFactor'
  | 'resinId'
  | 'finish'
  | 'painted'
  | 'base'
>;
type ItemValues = ItemChoices & ReturnType<typeof priceColumns>;

interface LoadedRequest {
  request: PrintRequest;
  items: PrintRequestItem[];
  files: Map<string, PrintFile>;
  resins: Map<string, Resin>;
}

/** Files that cannot be priced yet; a submitted request waits for them. */
const UNREADY_FILE_STATUSES = new Set(['uploading', 'analyzing', 'failed']);

/**
 * Customers ask Gripr Lab to print their own models: they choose a size,
 * resin, finish, painting, and base per model and see an estimate; staff
 * adjust the calculation and confirm the price, which is valid for 14 days
 * and is paid through the Lab cart.
 */
@Injectable()
export class PrintRequestsService {
  private readonly logger = new Logger(PrintRequestsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly customers: CustomersService,
  ) {}

  async options(): Promise<PrintOptionsDto> {
    const { settings } = await loadPrintContext(this.db);

    return {
      bases: settings.bases.map(({ code, name }) => ({ code, name })),
      finishes: [...PRINT_FINISHES],
      maxFileBytes: MODEL_FILE_LIMIT_BYTES,
      maxItems: MAX_PRINT_REQUEST_ITEMS,
      maxQuantity: MAX_PRINT_QUANTITY,
      priceValidDays: PRICE_VALID_DAYS,
    };
  }

  async create(
    user: User,
    dto: CreatePrintRequestDto,
  ): Promise<PrintRequestDto> {
    const id = await this.db.transaction(async (tx) => {
      await this.customers.ensure(user, tx);
      const [request] = await tx
        .insert(printRequests)
        .values({
          customerId: user.id,
          comment: dto.comment ?? null,
          rightsConfirmed: dto.rightsConfirmed ?? false,
        })
        .returning();

      if (dto.items?.length) {
        await this.replaceItems(tx, request.id, user.id, dto.items);
      }

      return request.id;
    });

    return this.getForCustomer(user, id);
  }

  async listForCustomer(
    user: User,
    query: PaginationQueryDto,
  ): Promise<PrintRequestPageDto> {
    const page = await this.page(eq(printRequests.customerId, user.id), query);

    return toPage(page.items.map(toCustomerDto), page.total, query);
  }

  async getForCustomer(user: User, id: string): Promise<PrintRequestDto> {
    return toCustomerDto(await this.load(this.db, await this.owned(user, id)));
  }

  /** Edits a draft or a request returned for changes; items are replaced. */
  async update(
    user: User,
    id: string,
    dto: UpdatePrintRequestDto,
  ): Promise<PrintRequestDto> {
    await this.db.transaction(async (tx) => {
      const request = await this.lockOwned(tx, user, id);

      if (!CUSTOMER_EDITABLE.includes(request.status)) {
        throw new ConflictException(
          'Only a draft or a returned request can be edited',
        );
      }

      const changes = {
        ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
        ...(dto.rightsConfirmed !== undefined
          ? { rightsConfirmed: dto.rightsConfirmed }
          : {}),
      };

      if (Object.keys(changes).length) {
        await tx
          .update(printRequests)
          .set(changes)
          .where(eq(printRequests.id, id));
      }

      if (dto.items !== undefined) {
        await this.replaceItems(tx, id, user.id, dto.items);
      }
    });

    return this.getForCustomer(user, id);
  }

  /** Prices items without saving them, e.g. while the customer chooses. */
  async quote(user: User, dto: PrintQuoteRequestDto): Promise<PrintQuoteDto> {
    const { prices } = await this.prepareItems(this.db, user.id, dto.items);

    return {
      items: prices.map(toPriceDto),
      estimate: estimateOf(prices),
    };
  }

  async submit(user: User, id: string): Promise<PrintRequestDto> {
    await this.db.transaction(async (tx) => {
      const request = await this.lockOwned(tx, user, id);
      assertTransition(request.status, 'submitted');
      const loaded = await this.load(tx, request);

      if (!loaded.items.length) {
        throw new BadRequestException('Add at least one model');
      }

      if (!request.rightsConfirmed) {
        throw new BadRequestException(
          'Confirm that you may have these models printed',
        );
      }

      const unready = loaded.items.filter((item) => {
        const file = item.fileId ? loaded.files.get(item.fileId) : undefined;
        return !file || UNREADY_FILE_STATUSES.has(file.status);
      });

      if (unready.length) {
        throw new BadRequestException(
          `These models are not ready: ${unready.map((item) => item.fileName).join(', ')}`,
        );
      }

      await this.reprice(tx, loaded);
      await tx
        .update(printRequests)
        .set({
          status: 'submitted',
          submittedAt: new Date(),
          staffNote: null,
        })
        .where(eq(printRequests.id, id));
    });

    return this.getForCustomer(user, id);
  }

  /** Ordered requests are cancelled with their order. */
  async cancel(user: User, id: string): Promise<PrintRequestDto> {
    await this.db.transaction(async (tx) => {
      const request = await this.lockOwned(tx, user, id);

      if (request.status === 'ordered') {
        throw new ConflictException('Cancel the order instead');
      }

      assertTransition(request.status, 'cancelled');
      await this.setStatus(tx, id, 'cancelled');
    });

    return this.getForCustomer(user, id);
  }

  /** Puts a confirmed print into the Lab cart while its price is valid. */
  async addToCart(user: User, id: string): Promise<PrintRequestDto> {
    const expired = await this.db.transaction(async (tx) => {
      const request = await this.lockOwned(tx, user, id);

      if (request.status !== 'confirmed') {
        throw new ConflictException(
          'Only a confirmed print can be added to the cart',
        );
      }

      if (isPriceExpired(request.confirmedAt, new Date())) {
        await this.expire(tx, [id]);
        return true;
      }

      await this.setStatus(tx, id, 'in_cart');
      return false;
    });

    if (expired) {
      throw new ConflictException(
        'The confirmed price expired; the Lab checks it again',
      );
    }

    return this.getForCustomer(user, id);
  }

  async removeFromCart(user: User, id: string): Promise<PrintRequestDto> {
    await this.db.transaction(async (tx) => {
      const request = await this.lockOwned(tx, user, id);

      if (request.status !== 'in_cart') {
        throw new ConflictException('The print is not in the cart');
      }

      await this.setStatus(tx, id, 'confirmed');
    });

    return this.getForCustomer(user, id);
  }

  /** Drafts stay with the customer unless asked for by status. */
  async listForAdmin(
    query: AdminPrintRequestListQueryDto,
  ): Promise<AdminPrintRequestPageDto> {
    const page = await this.page(
      query.status
        ? eq(printRequests.status, query.status)
        : ne(printRequests.status, 'draft'),
      query,
    );

    return toPage(page.items.map(toAdminDto), page.total, query);
  }

  async getForAdmin(id: string): Promise<AdminPrintRequestDto> {
    return toAdminDto(await this.load(this.db, await this.find(this.db, id)));
  }

  /** Staff adjust the calculation; a submitted request moves to review. */
  async updateForAdmin(
    id: string,
    dto: AdminUpdatePrintRequestDto,
  ): Promise<AdminPrintRequestDto> {
    await this.db.transaction(async (tx) => {
      const request = await this.find(tx, id, true);

      if (!STAFF_REVIEWABLE.includes(request.status)) {
        throw new ConflictException('Only submitted requests are reviewed');
      }

      const daysMin =
        dto.productionDaysMin === undefined
          ? request.productionDaysMin
          : dto.productionDaysMin;
      const daysMax =
        dto.productionDaysMax === undefined
          ? request.productionDaysMax
          : dto.productionDaysMax;

      if (daysMin !== null && daysMax !== null && daysMin > daysMax) {
        throw new BadRequestException(
          'productionDaysMin must not exceed productionDaysMax',
        );
      }

      await tx
        .update(printRequests)
        .set({
          status: 'in_review',
          ...(dto.staffNote !== undefined ? { staffNote: dto.staffNote } : {}),
          productionDaysMin: daysMin,
          productionDaysMax: daysMax,
        })
        .where(eq(printRequests.id, id));

      const loaded = await this.load(tx, request);

      if (dto.items?.length) {
        await this.applyStaffItems(tx, loaded, dto.items);
      }

      await this.reprice(tx, await this.load(tx, request));
    });

    return this.getForAdmin(id);
  }

  /** Confirms the current price of every item for 14 days. */
  async confirm(id: string): Promise<AdminPrintRequestDto> {
    await this.db.transaction(async (tx) => {
      const request = await this.find(tx, id, true);

      if (!STAFF_REVIEWABLE.includes(request.status)) {
        throw new ConflictException('Only submitted requests are confirmed');
      }

      const prices = await this.reprice(tx, await this.load(tx, request));
      const unpriced = prices.filter((price) => price.error);

      if (unpriced.length) {
        throw new ConflictException(
          `Price every item first: ${unpriced.map((price) => price.error).join('; ')}`,
        );
      }

      const { settings } = await loadPrintContext(tx);
      await tx
        .update(printRequests)
        .set({
          status: 'confirmed',
          confirmedPrice: estimateOf(prices),
          confirmedAt: new Date(),
          productionDaysMin:
            request.productionDaysMin ?? settings.price.productionDaysMin,
          productionDaysMax:
            request.productionDaysMax ?? settings.price.productionDaysMax,
        })
        .where(eq(printRequests.id, id));
    });

    return this.getForAdmin(id);
  }

  /** Returns the request to the customer with what to change. */
  requestChanges(
    staff: User,
    id: string,
    note: string,
  ): Promise<AdminPrintRequestDto> {
    return this.closeReview(staff, id, 'changes_requested', note);
  }

  reject(staff: User, id: string, note: string): Promise<AdminPrintRequestDto> {
    return this.closeReview(staff, id, 'rejected', note);
  }

  /** Confirmed prices older than 14 days go back to staff review. */
  @Cron('45 3 * * *', {
    name: 'print-request-expiry',
    timeZone: 'Europe/Kyiv',
  })
  async expireConfirmations(now = new Date()): Promise<number> {
    const rows = await this.db
      .select({ id: printRequests.id })
      .from(printRequests)
      .where(
        and(
          inArray(printRequests.status, ['confirmed', 'in_cart']),
          lte(
            printRequests.confirmedAt,
            new Date(now.getTime() - PRICE_VALID_DAYS * 86_400_000),
          ),
        ),
      );

    if (rows.length) {
      await this.expire(
        this.db,
        rows.map((row) => row.id),
      );
      this.logger.log(`Returned ${rows.length} expired print prices to review`);
    }

    return rows.length;
  }

  private async closeReview(
    staff: User,
    id: string,
    to: 'changes_requested' | 'rejected',
    note: string,
  ): Promise<AdminPrintRequestDto> {
    await this.db.transaction(async (tx) => {
      const request = await this.find(tx, id, true);

      if (!STAFF_REVIEWABLE.includes(request.status)) {
        throw new ConflictException('Only submitted requests are reviewed');
      }

      await tx
        .update(printRequests)
        .set({ status: to, staffNote: note })
        .where(eq(printRequests.id, id));
      await tx.insert(messages).values({
        printRequestId: id,
        authorId: staff.id,
        authorRole: 'staff',
        body: note,
      });
    });

    return this.getForAdmin(id);
  }

  private async expire(executor: DatabaseExecutor, ids: string[]) {
    await executor
      .update(printRequests)
      .set({
        status: 'in_review',
        confirmedPrice: null,
        confirmedAt: null,
      })
      .where(
        and(
          inArray(printRequests.id, ids),
          inArray(printRequests.status, ['confirmed', 'in_cart']),
        ),
      );
  }

  private async replaceItems(
    tx: DatabaseExecutor,
    requestId: string,
    customerId: string,
    inputs: PrintRequestItemInputDto[],
  ): Promise<void> {
    const { values, prices } = await this.prepareItems(tx, customerId, inputs);

    await tx
      .delete(printRequestItems)
      .where(eq(printRequestItems.requestId, requestId));

    if (values.length) {
      await tx
        .insert(printRequestItems)
        .values(values.map((value) => ({ ...value, requestId })));
    }

    await tx
      .update(printRequests)
      .set({ estimate: estimateOf(prices) })
      .where(eq(printRequests.id, requestId));
  }

  /** Checks the customer's choices and prices them. */
  private async prepareItems(
    executor: DatabaseExecutor,
    customerId: string,
    inputs: PrintRequestItemInputDto[],
  ): Promise<{ values: ItemValues[]; prices: CustomPrintPrice[] }> {
    if (inputs.some((input) => input.heightMm && input.scaleFactor)) {
      throw new BadRequestException(
        'Choose a height or a scale factor, not both',
      );
    }

    const fileIds = [...new Set(inputs.map((input) => input.fileId))];
    const files = new Map(
      (fileIds.length
        ? await executor
            .select()
            .from(printFiles)
            .where(
              and(
                inArray(printFiles.id, fileIds),
                eq(printFiles.customerId, customerId),
              ),
            )
        : []
      ).map((file) => [file.id, file]),
    );

    if (files.size !== fileIds.length) {
      throw new BadRequestException('Unknown model file');
    }

    const ctx = await loadPrintContext(executor);
    const values = inputs.map((input, position): ItemChoices => {
      const resin = input.resinId
        ? ctx.resins.get(input.resinId)
        : ctx.defaultResin;

      if (input.resinId && !resin?.isActive) {
        throw new BadRequestException('The resin is not available');
      }

      const base = input.baseCode
        ? ctx.settings.bases.find((option) => option.code === input.baseCode)
        : null;

      if (base === undefined) {
        throw new BadRequestException(`Unknown base "${input.baseCode}"`);
      }

      return {
        position,
        fileId: input.fileId,
        fileName: files.get(input.fileId)!.fileName,
        quantity: input.quantity ?? 1,
        heightMm: input.heightMm ?? null,
        scaleFactor: input.scaleFactor ?? null,
        resinId: resin?.id ?? null,
        finish: input.finish ?? 'supports_removed',
        painted: input.painted ?? false,
        base,
      };
    });
    const prices = values.map((value) =>
      priceCustomPrint(
        toCustomItem(value),
        files.get(value.fileId!) ?? null,
        ctx,
      ),
    );

    return {
      values: values.map((value, index) => ({
        ...value,
        ...priceColumns(prices[index]),
      })),
      prices,
    };
  }

  private async applyStaffItems(
    tx: DatabaseExecutor,
    loaded: LoadedRequest,
    inputs: NonNullable<AdminUpdatePrintRequestDto['items']>,
  ): Promise<void> {
    const ids = new Set(loaded.items.map((item) => item.id));

    if (inputs.some((input) => !ids.has(input.id))) {
      throw new BadRequestException('Unknown request item');
    }

    const printerIds = [
      ...new Set(inputs.flatMap((input) => input.printerId ?? [])),
    ];

    if (printerIds.length) {
      const found = await tx
        .select({ id: printers.id })
        .from(printers)
        .where(inArray(printers.id, printerIds));

      if (found.length !== printerIds.length) {
        throw new BadRequestException('Unknown printer');
      }
    }

    for (const input of inputs) {
      await tx
        .update(printRequestItems)
        .set({
          ...(input.printerId !== undefined
            ? { printerId: input.printerId }
            : {}),
          ...(input.paintingMultiplier !== undefined
            ? { paintingMultiplier: input.paintingMultiplier }
            : {}),
          ...(input.overrides !== undefined
            ? {
                overrides: input.overrides
                  ? toOverrides(input.overrides)
                  : null,
              }
            : {}),
        })
        .where(eq(printRequestItems.id, input.id));
    }
  }

  /** Prices the stored items again with the current rates and settings. */
  private async reprice(
    tx: DatabaseExecutor,
    loaded: LoadedRequest,
  ): Promise<CustomPrintPrice[]> {
    const contexts = new Map<string | null, Promise<PrintContext>>();
    const contextFor = (printerId: string | null) => {
      if (!contexts.has(printerId)) {
        contexts.set(printerId, loadPrintContext(tx, printerId ?? undefined));
      }

      return contexts.get(printerId)!;
    };
    const prices: CustomPrintPrice[] = [];

    for (const item of loaded.items) {
      const price = priceCustomPrint(
        toCustomItem(item),
        (item.fileId && loaded.files.get(item.fileId)) || null,
        await contextFor(item.printerId),
      );
      prices.push(price);
      await tx
        .update(printRequestItems)
        .set({ ...priceColumns(price) })
        .where(eq(printRequestItems.id, item.id));
    }

    await tx
      .update(printRequests)
      .set({ estimate: estimateOf(prices) })
      .where(eq(printRequests.id, loaded.request.id));

    return prices;
  }

  private async page(where: SQL | undefined, query: PaginationQueryDto) {
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(printRequests)
        .where(where)
        .orderBy(
          sql`${printRequests.submittedAt} desc nulls last`,
          desc(printRequests.createdAt),
        )
        .limit(query.pageSize)
        .offset(toOffset(query)),
      this.db.select({ total: count() }).from(printRequests).where(where),
    ]);

    return {
      items: await Promise.all(rows.map((row) => this.load(this.db, row))),
      total,
    };
  }

  private async load(
    executor: DatabaseExecutor,
    request: PrintRequest,
  ): Promise<LoadedRequest> {
    const items = await executor
      .select()
      .from(printRequestItems)
      .where(eq(printRequestItems.requestId, request.id))
      .orderBy(asc(printRequestItems.position));
    const fileIds = items.flatMap((item) => item.fileId ?? []);
    const resinIds = [...new Set(items.flatMap((item) => item.resinId ?? []))];
    const [fileRows, resinRows] = await Promise.all([
      fileIds.length
        ? executor
            .select()
            .from(printFiles)
            .where(inArray(printFiles.id, fileIds))
        : ([] as PrintFile[]),
      resinIds.length
        ? executor.select().from(resins).where(inArray(resins.id, resinIds))
        : ([] as Resin[]),
    ]);

    return {
      request,
      items,
      files: new Map(fileRows.map((file) => [file.id, file])),
      resins: new Map(resinRows.map((resin) => [resin.id, resin])),
    };
  }

  private async setStatus(
    tx: DatabaseExecutor,
    id: string,
    status: PrintRequestStatus,
  ): Promise<void> {
    await tx
      .update(printRequests)
      .set({ status })
      .where(eq(printRequests.id, id));
  }

  private async owned(user: User, id: string): Promise<PrintRequest> {
    const [request] = await this.db
      .select()
      .from(printRequests)
      .where(
        and(eq(printRequests.id, id), eq(printRequests.customerId, user.id)),
      );

    if (!request) {
      throw new NotFoundException('Print request not found');
    }

    return request;
  }

  private async lockOwned(
    tx: DatabaseExecutor,
    user: User,
    id: string,
  ): Promise<PrintRequest> {
    const [request] = await tx
      .select()
      .from(printRequests)
      .where(
        and(eq(printRequests.id, id), eq(printRequests.customerId, user.id)),
      )
      .for('update');

    if (!request) {
      throw new NotFoundException('Print request not found');
    }

    return request;
  }

  private async find(
    executor: DatabaseExecutor,
    id: string,
    lock = false,
  ): Promise<PrintRequest> {
    const query = executor
      .select()
      .from(printRequests)
      .where(eq(printRequests.id, id));
    const [request] = await (lock ? query.for('update') : query);

    if (!request) {
      throw new NotFoundException('Print request not found');
    }

    return request;
  }
}

function assertTransition(from: PrintRequestStatus, to: PrintRequestStatus) {
  if (!canTransitionPrintRequest(from, to)) {
    throw new ConflictException(
      `A ${from.replace('_', ' ')} request cannot be ${to.replace('_', ' ')}`,
    );
  }
}

function toCustomItem(
  item: Pick<
    PrintRequestItem,
    | 'quantity'
    | 'heightMm'
    | 'scaleFactor'
    | 'resinId'
    | 'finish'
    | 'painted'
    | 'base'
  > &
    Partial<Pick<PrintRequestItem, 'paintingMultiplier' | 'overrides'>>,
) {
  return {
    quantity: item.quantity,
    heightMm: item.heightMm,
    scaleFactor: item.scaleFactor,
    resinId: item.resinId,
    finish: item.finish,
    painted: item.painted,
    base: item.base,
    paintingMultiplier: item.paintingMultiplier ?? null,
    overrides: item.overrides ?? null,
  };
}

function toOverrides(input: Partial<PrintOverrides>): PrintOverrides {
  return {
    supportRate: input.supportRate ?? NO_PRINT_OVERRIDES.supportRate,
    resinMl: input.resinMl ?? NO_PRINT_OVERRIDES.resinMl,
    printHours: input.printHours ?? NO_PRINT_OVERRIDES.printHours,
    plateShare: input.plateShare ?? NO_PRINT_OVERRIDES.plateShare,
  };
}

function priceColumns(price: CustomPrintPrice) {
  return {
    unitPrice: price.unitPrice,
    lineTotal: price.lineTotal,
    priceError: price.error,
    calculation: price.calculation,
  };
}

function estimateOf(prices: CustomPrintPrice[]): number | null {
  return prices.length && prices.every((price) => price.lineTotal !== null)
    ? prices.reduce((sum, price) => sum + price.lineTotal, 0)
    : null;
}

function toPriceDto(price: CustomPrintPrice): PrintItemPriceDto {
  return {
    unitPrice: price.unitPrice,
    lineTotal: price.lineTotal,
    priceError: price.error,
    sizeMm: price.calculation?.sizeMm ?? null,
    fitsPrinter: price.calculation?.fitsPrinter ?? null,
  };
}

function toItemDto(
  item: PrintRequestItem,
  loaded: LoadedRequest,
): PrintRequestItemDto {
  const file = item.fileId ? loaded.files.get(item.fileId) : undefined;
  const resin = item.resinId ? loaded.resins.get(item.resinId) : undefined;

  return {
    id: item.id,
    file: file
      ? {
          id: file.id,
          status: file.status,
          volumeMl: file.volumeMl,
          sizeMm: file.sizeMm,
        }
      : null,
    fileName: item.fileName,
    quantity: item.quantity,
    heightMm: item.heightMm,
    scaleFactor: item.scaleFactor,
    resin: resin ? { id: resin.id, name: resin.name } : null,
    finish: item.finish,
    painted: item.painted,
    base: item.base ? { code: item.base.code, name: item.base.name } : null,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    priceError: item.priceError,
    sizeMm: item.calculation?.sizeMm ?? null,
    fitsPrinter: item.calculation?.fitsPrinter ?? null,
  };
}

function toCustomerDto(loaded: LoadedRequest): PrintRequestDto {
  const { request } = loaded;

  return {
    id: request.id,
    status: request.status,
    comment: request.comment,
    rightsConfirmed: request.rightsConfirmed,
    items: loaded.items.map((item) => toItemDto(item, loaded)),
    estimate: request.estimate,
    confirmedPrice: request.confirmedPrice,
    confirmedAt: request.confirmedAt,
    priceValidUntil: priceValidUntil(request.confirmedAt),
    staffNote: request.staffNote,
    productionDaysMin: request.productionDaysMin,
    productionDaysMax: request.productionDaysMax,
    orderId: request.orderId,
    submittedAt: request.submittedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

function toAdminDto(loaded: LoadedRequest): AdminPrintRequestDto {
  return {
    ...toCustomerDto(loaded),
    customerId: loaded.request.customerId,
    items: loaded.items.map((item): AdminPrintRequestItemDto => ({
      ...toItemDto(item, loaded),
      printerId: item.printerId,
      paintingMultiplier: item.paintingMultiplier,
      overrides: item.overrides,
      basePrice: item.base?.price ?? null,
      calculation: item.calculation,
    })),
  };
}
