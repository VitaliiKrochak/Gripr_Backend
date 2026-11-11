import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { User } from '@supabase/supabase-js';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  notExists,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import { qualified } from '../../integrations/database/database.sql';
import type { Database } from '../../integrations/database/database.client';
import {
  customProposals,
  customRequests,
  orders,
  printers,
  printFiles,
  printRequestItems,
  printRequests,
  products,
} from '../../integrations/database/database.schema';
import type {
  CustomRequestStatus,
  OrderStatus,
  PrintFile,
  PrintRequestStatus,
} from '../../integrations/database/database.schema';
import {
  MODEL_FILE_LIMIT_BYTES,
  SupabaseStorageService,
} from '../../integrations/supabase/supabase.storage.service';
import { CustomersService } from '../customers/customers.service';
import {
  deliversFile,
  modelDownloadBlocker,
  PERSONAL_USE_LICENSE,
} from '../orders/order.modeling';
import type {
  AdminPrintFileDto,
  AdminPrintFileUploadDto,
  CreatePrintFileDto,
  CreateProductPrintFileDto,
  MeasurePrintFileDto,
  ModelFileDownloadDto,
  PrintFileDownloadDto,
  PrintFileDto,
  PrintFileUploadDto,
} from './dto/print.file.dto';
import {
  fitsBuildVolume,
  isMeasured,
  modelExtension,
} from './mesh/mesh.analysis';
import { MeshAnalyzer } from './mesh/mesh.analyzer';
import { MeshError } from './mesh/mesh.measure';

const DOWNLOAD_SECONDS = 10 * 60;
const ABANDONED_UPLOAD_MS = 24 * 60 * 60 * 1000;
const STALLED_ANALYSIS_MS = 60 * 60 * 1000;
const CUSTOMER_FILE_DAYS = 30;
/** Requests whose files are kept regardless of age. */
const ACTIVE_REQUEST_STATUSES: PrintRequestStatus[] = [
  'submitted',
  'in_review',
  'changes_requested',
  'confirmed',
  'in_cart',
];
const OPEN_CUSTOM_REQUEST_STATUSES: CustomRequestStatus[] = [
  'new',
  'in_review',
  'quoted',
  'changes_requested',
];
const CLOSED_ORDER_STATUSES: OrderStatus[] = [
  'delivered',
  'completed',
  'cancelled',
  'refunded',
];

type Owner =
  { customerId: string } | { productId: string } | { orderId: string };

@Injectable()
export class PrintFilesService {
  private readonly logger = new Logger(PrintFilesService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly storage: SupabaseStorageService,
    private readonly analyzer: MeshAnalyzer,
    private readonly customers: CustomersService,
  ) {}

  async createForCustomer(
    user: User,
    dto: CreatePrintFileDto,
  ): Promise<PrintFileUploadDto> {
    this.assertConfigured();
    await this.customers.ensure(user);
    const upload = await this.createUpload({ customerId: user.id }, dto);

    return { ...upload, file: toPrintFile(upload.file) };
  }

  async createForProduct(
    dto: CreateProductPrintFileDto,
  ): Promise<AdminPrintFileUploadDto> {
    this.assertConfigured();
    const [product] = await this.db
      .select({ store: products.store })
      .from(products)
      .where(eq(products.id, dto.productId));

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.store !== 'lab') {
      throw new BadRequestException('Model files belong to Gripr Lab products');
    }

    const upload = await this.createUpload({ productId: dto.productId }, dto);

    return { ...upload, file: toAdminPrintFile(upload.file) };
  }

  /** Staff upload the modeled file a Gripr Lab order delivers. */
  async createForOrder(
    orderId: string,
    dto: CreatePrintFileDto,
  ): Promise<AdminPrintFileUploadDto> {
    this.assertConfigured();
    const [order] = await this.db
      .select({ status: orders.status, modeling: orders.modeling })
      .from(orders)
      .where(eq(orders.id, orderId));

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.modeling || !deliversFile(order.modeling.deliverable)) {
      throw new BadRequestException(
        'Only Gripr Lab orders that deliver the model file take model files',
      );
    }

    if (order.status === 'cancelled' || order.status === 'refunded') {
      throw new ConflictException('The order is closed');
    }

    const upload = await this.createUpload({ orderId }, dto);

    return { ...upload, file: toAdminPrintFile(upload.file) };
  }

  async listForOrder(orderId: string): Promise<AdminPrintFileDto[]> {
    const rows = await this.db
      .select()
      .from(printFiles)
      .where(eq(printFiles.orderId, orderId))
      .orderBy(desc(printFiles.createdAt));

    return rows.map(toAdminPrintFile);
  }

  /** Uploaded model files of the customer's order, downloadable or not yet. */
  async listForCustomerOrder(
    user: User,
    orderId: string,
  ): Promise<PrintFileDto[]> {
    await this.ownOrder(user, orderId);
    const rows = await this.db
      .select()
      .from(printFiles)
      .where(
        and(
          eq(printFiles.orderId, orderId),
          ne(printFiles.status, 'uploading'),
        ),
      )
      .orderBy(desc(printFiles.createdAt));

    return rows.map(toPrintFile);
  }

  /** A model file of an approved, fully paid order, with its license. */
  async downloadForCustomer(
    user: User,
    orderId: string,
    fileId: string,
  ): Promise<ModelFileDownloadDto> {
    this.assertConfigured();
    const order = await this.ownOrder(user, orderId);
    const [file] = await this.db
      .select()
      .from(printFiles)
      .where(
        and(
          eq(printFiles.id, fileId),
          eq(printFiles.orderId, orderId),
          ne(printFiles.status, 'uploading'),
        ),
      );

    if (!file) {
      throw new NotFoundException('Model file not found');
    }

    const blocker = modelDownloadBlocker(order);

    if (blocker) {
      throw new ConflictException(blocker);
    }

    return {
      url: await this.storage.createDownloadUrl(
        file.storagePath,
        file.fileName,
        DOWNLOAD_SECONDS,
      ),
      expiresAt: new Date(Date.now() + DOWNLOAD_SECONDS * 1000),
      license: order.modeling!.license ?? PERSONAL_USE_LICENSE,
    };
  }

  async completeForCustomer(user: User, id: string): Promise<PrintFileDto> {
    return toPrintFile(await this.complete(await this.owned(user, id)));
  }

  async completeForAdmin(id: string): Promise<AdminPrintFileDto> {
    return toAdminPrintFile(await this.complete(await this.find(id)));
  }

  async getForCustomer(user: User, id: string): Promise<PrintFileDto> {
    return toPrintFile(await this.owned(user, id));
  }

  async getForAdmin(id: string): Promise<AdminPrintFileDto> {
    return toAdminPrintFile(await this.find(id));
  }

  async listForProduct(productId: string): Promise<AdminPrintFileDto[]> {
    const rows = await this.db
      .select()
      .from(printFiles)
      .where(eq(printFiles.productId, productId))
      .orderBy(desc(printFiles.createdAt));

    return rows.map(toAdminPrintFile);
  }

  /** A file in a request that is not cancelled or rejected stays. */
  async deleteForCustomer(user: User, id: string): Promise<void> {
    const file = await this.owned(user, id);
    const [usedBy] = await this.db
      .select({ id: printRequests.id })
      .from(printRequestItems)
      .innerJoin(
        printRequests,
        eq(printRequests.id, printRequestItems.requestId),
      )
      .where(
        and(
          eq(printRequestItems.fileId, id),
          notInArray(printRequests.status, ['cancelled', 'rejected']),
        ),
      )
      .limit(1);

    if (usedBy) {
      throw new ConflictException(
        'The model is part of a print request; remove it from the request first',
      );
    }

    const [source] = await this.customRequestUses(sql`${id}`);

    if (source) {
      throw new ConflictException(
        'The model is the source file of an open custom request',
      );
    }

    await this.remove(file);
  }

  async deleteForAdmin(id: string): Promise<void> {
    const file = await this.find(id);
    const [usedBy] = await this.db
      .select({ id: products.id })
      .from(products)
      .where(sql`${products.print}->>'printFileId' = ${id}`)
      .limit(1);

    if (usedBy) {
      throw new ConflictException(
        'A product takes its print size from this file',
      );
    }

    await this.remove(file);
  }

  async download(id: string): Promise<PrintFileDownloadDto> {
    this.assertConfigured();
    const file = await this.find(id);

    if (file.status === 'uploading') {
      throw new ConflictException('The file has not been uploaded yet');
    }

    return {
      url: await this.storage.createDownloadUrl(
        file.storagePath,
        file.fileName,
        DOWNLOAD_SECONDS,
      ),
      expiresAt: new Date(Date.now() + DOWNLOAD_SECONDS * 1000),
    };
  }

  /** Staff enter the volume and size of a file measured by hand (STEP). */
  async measure(
    id: string,
    dto: MeasurePrintFileDto,
  ): Promise<AdminPrintFileDto> {
    const file = await this.find(id);

    if (file.status !== 'manual') {
      throw new ConflictException(
        'Only files that are not measured automatically take staff measurements',
      );
    }

    const [updated] = await this.db
      .update(printFiles)
      .set({
        volumeMl: dto.volumeMl,
        sizeMm: { x: dto.sizeMm.x, y: dto.sizeMm.y, z: dto.sizeMm.z },
        warnings: (await this.fitsDefaultPrinter(dto.sizeMm))
          ? []
          : ['exceeds_build_volume'],
        analyzedAt: new Date(),
      })
      .where(eq(printFiles.id, id))
      .returning();

    return toAdminPrintFile(updated);
  }

  /**
   * Deletes abandoned uploads (24 hours), customer files after 30 days,
   * and files whose owner was deleted; marks stalled analyses as failed.
   * Customer files stay while a print request or a Gripr Lab custom request
   * needs them: until 30 days after the request (or its order) was last
   * active.
   */
  @Cron('30 3 * * *', { name: 'print-file-cleanup', timeZone: 'Europe/Kyiv' })
  async cleanup(now = new Date()): Promise<number> {
    await this.db
      .update(printFiles)
      .set({ status: 'failed', error: 'Measuring the file was interrupted' })
      .where(
        and(
          eq(printFiles.status, 'analyzing'),
          lt(
            printFiles.updatedAt,
            new Date(now.getTime() - STALLED_ANALYSIS_MS),
          ),
        ),
      );

    if (!this.storage.isConfigured()) return 0;

    const customerCutoff = new Date(
      now.getTime() - CUSTOMER_FILE_DAYS * 86_400_000,
    );

    const expired = await this.db
      .select()
      .from(printFiles)
      .where(
        or(
          and(
            eq(printFiles.status, 'uploading'),
            lt(
              printFiles.createdAt,
              new Date(now.getTime() - ABANDONED_UPLOAD_MS),
            ),
          ),
          and(
            sql`${printFiles.customerId} is not null`,
            lt(printFiles.createdAt, customerCutoff),
            notExists(
              this.db
                .select({ id: printRequestItems.id })
                .from(printRequestItems)
                .innerJoin(
                  printRequests,
                  eq(printRequests.id, printRequestItems.requestId),
                )
                .leftJoin(orders, eq(orders.id, printRequests.orderId))
                .where(
                  and(
                    eq(printRequestItems.fileId, qualified(printFiles.id)),
                    or(
                      inArray(printRequests.status, ACTIVE_REQUEST_STATUSES),
                      gte(printRequests.updatedAt, customerCutoff),
                      and(
                        eq(printRequests.status, 'ordered'),
                        or(
                          notInArray(orders.status, CLOSED_ORDER_STATUSES),
                          gte(orders.updatedAt, customerCutoff),
                        ),
                      ),
                    ),
                  ),
                ),
            ),
            notExists(
              this.customRequestUses(qualified(printFiles.id), customerCutoff),
            ),
          ),
          and(
            isNull(printFiles.customerId),
            isNull(printFiles.productId),
            isNull(printFiles.orderId),
          ),
        ),
      );

    if (!expired.length) return 0;

    await this.storage.remove(expired.map((file) => file.storagePath));
    await this.db.delete(printFiles).where(
      inArray(
        printFiles.id,
        expired.map((file) => file.id),
      ),
    );
    this.logger.log(`Removed ${expired.length} model files`);

    return expired.length;
  }

  /**
   * Gripr Lab custom requests (or their proposals) that start from the file
   * and are open, accepted into an order that is not closed, or, with
   * `activeSince`, were active since then.
   */
  private customRequestUses(fileId: SQL, activeSince?: Date) {
    return this.db
      .select({ id: customRequests.id })
      .from(customRequests)
      .leftJoin(
        customProposals,
        eq(customProposals.requestId, customRequests.id),
      )
      .leftJoin(orders, eq(orders.id, customRequests.orderId))
      .where(
        and(
          or(
            sql`${customRequests.labSpecification}->'sourceFile'->>'id' = ${fileId}::text`,
            sql`${customProposals.labSpecification}->'sourceFile'->>'id' = ${fileId}::text`,
          ),
          or(
            inArray(customRequests.status, OPEN_CUSTOM_REQUEST_STATUSES),
            and(
              eq(customRequests.status, 'accepted'),
              notInArray(orders.status, CLOSED_ORDER_STATUSES),
            ),
            ...(activeSince
              ? [
                  gte(customRequests.updatedAt, activeSince),
                  gte(orders.updatedAt, activeSince),
                ]
              : []),
          ),
        ),
      )
      .limit(1);
  }

  private async createUpload(
    owner: Owner,
    dto: CreatePrintFileDto,
  ): Promise<Omit<PrintFileUploadDto, 'file'> & { file: PrintFile }> {
    const extension = modelExtension(dto.fileName);

    if (!extension) {
      throw new BadRequestException(
        'Upload an STL, OBJ, 3MF, ZIP, or STEP file',
      );
    }

    const id = randomUUID();
    const storagePath =
      'customerId' in owner
        ? `customers/${owner.customerId}/${id}.${extension}`
        : 'productId' in owner
          ? `products/${owner.productId}/${id}.${extension}`
          : `deliverables/${owner.orderId}/${id}.${extension}`;
    const upload = await this.storage.createUploadUrl(storagePath);
    const [file] = await this.db
      .insert(printFiles)
      .values({
        id,
        ...owner,
        fileName: dto.fileName,
        extension,
        sizeBytes: dto.sizeBytes,
        storagePath,
      })
      .returning();

    return {
      file,
      uploadUrl: upload.url,
      uploadToken: upload.token,
      storagePath,
    };
  }

  /** The browser finished uploading: check the stored size and measure. */
  private async complete(file: PrintFile): Promise<PrintFile> {
    this.assertConfigured();

    if (file.status !== 'uploading') {
      throw new ConflictException('The file was already uploaded');
    }

    const size = await this.storage.size(file.storagePath);

    if (size === null) {
      throw new ConflictException('The file has not been uploaded yet');
    }

    if (size > MODEL_FILE_LIMIT_BYTES) {
      await this.storage.remove([file.storagePath]);
      return this.update(file.id, {
        status: 'failed',
        sizeBytes: size,
        error: 'The file is larger than 50 MB',
        uploadedAt: new Date(),
      });
    }

    const measured = isMeasured(modelExtension(file.fileName)!);
    const updated = await this.update(file.id, {
      status: measured ? 'analyzing' : 'manual',
      sizeBytes: size,
      uploadedAt: new Date(),
    });

    if (measured) {
      void this.analyze(updated);
    }

    return updated;
  }

  private async analyze(file: PrintFile): Promise<void> {
    try {
      const bytes = await this.storage.download(file.storagePath);
      const analysis = await this.analyzer.analyze(file.fileName, bytes);
      const warnings = (await this.fitsDefaultPrinter(analysis.sizeMm))
        ? analysis.warnings
        : [...analysis.warnings, 'exceeds_build_volume' as const];

      await this.update(file.id, {
        status: 'analyzed',
        error: null,
        volumeMl: analysis.volumeMl,
        sizeMm: analysis.sizeMm,
        triangles: analysis.triangles,
        isWatertight: analysis.isWatertight,
        units: analysis.units,
        parts: analysis.parts,
        warnings,
        analyzedAt: new Date(),
      });
    } catch (error) {
      if (!(error instanceof MeshError)) {
        this.logger.error(
          `Model file ${file.id} analysis failed: ${String(error)}`,
        );
      }

      await this.update(file.id, {
        status: 'failed',
        error:
          error instanceof MeshError
            ? error.message
            : 'The file could not be read',
      }).catch(() => undefined);
    }
  }

  private async fitsDefaultPrinter(size: {
    x: number;
    y: number;
    z: number;
  }): Promise<boolean> {
    const [printer] = await this.db
      .select()
      .from(printers)
      .where(eq(printers.isActive, true))
      .orderBy(desc(printers.isDefault), asc(printers.sortOrder))
      .limit(1);

    return (
      !printer ||
      fitsBuildVolume(size, {
        x: printer.buildXMm,
        y: printer.buildYMm,
        z: printer.buildZMm,
      })
    );
  }

  private async update(
    id: string,
    values: Partial<typeof printFiles.$inferInsert>,
  ): Promise<PrintFile> {
    const [updated] = await this.db
      .update(printFiles)
      .set(values)
      .where(eq(printFiles.id, id))
      .returning();

    return updated;
  }

  private async remove(file: PrintFile): Promise<void> {
    if (this.storage.isConfigured()) {
      await this.storage.remove([file.storagePath]);
    }

    await this.db.delete(printFiles).where(eq(printFiles.id, file.id));
  }

  private async ownOrder(user: User, orderId: string) {
    const [order] = await this.db
      .select({
        status: orders.status,
        paidAmount: orders.paidAmount,
        total: orders.total,
        modeling: orders.modeling,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, user.id)));

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  private async owned(user: User, id: string): Promise<PrintFile> {
    const [file] = await this.db
      .select()
      .from(printFiles)
      .where(and(eq(printFiles.id, id), eq(printFiles.customerId, user.id)));

    if (!file) {
      throw new NotFoundException('Model file not found');
    }

    return file;
  }

  private async find(id: string): Promise<PrintFile> {
    const [file] = await this.db
      .select()
      .from(printFiles)
      .where(eq(printFiles.id, id));

    if (!file) {
      throw new NotFoundException('Model file not found');
    }

    return file;
  }

  private assertConfigured(): void {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException(
        'Model file uploads are not set up yet',
      );
    }
  }
}

function toPrintFile(file: PrintFile): PrintFileDto {
  return {
    id: file.id,
    fileName: file.fileName,
    extension: file.extension,
    sizeBytes: file.sizeBytes,
    status: file.status,
    error: file.error,
    volumeMl: file.volumeMl,
    sizeMm: file.sizeMm,
    triangles: file.triangles,
    isWatertight: file.isWatertight,
    units: file.units,
    parts: file.parts,
    warnings: file.warnings,
    uploadedAt: file.uploadedAt,
    analyzedAt: file.analyzedAt,
    createdAt: file.createdAt,
  };
}

function toAdminPrintFile(file: PrintFile): AdminPrintFileDto {
  return {
    ...toPrintFile(file),
    customerId: file.customerId,
    productId: file.productId,
    orderId: file.orderId,
  };
}
