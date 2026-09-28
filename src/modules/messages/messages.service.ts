import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  customRequests,
  messages,
  orders,
  productionStages,
} from '../../integrations/database/database.schema';
import type { MessageAuthorRole } from '../../integrations/database/database.schema';
import { customerUploadFolder } from '../media/media.folders';
import type { CreateMessageDto, MessageDto } from './message.dto';

/** Who is reading or writing; customers only reach their own threads. */
export interface MessageAuthor {
  id: string;
  role: MessageAuthorRole;
}

interface Thread {
  orderId: string | null;
  requestId: string | null;
}

/**
 * Conversation between a customer and the workshop. An order created from a
 * custom request shares one thread with that request.
 */
@Injectable()
export class MessagesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async listForOrder(
    author: MessageAuthor,
    orderId: string,
  ): Promise<MessageDto[]> {
    return this.list(await this.orderThread(author, orderId));
  }

  async listForRequest(
    author: MessageAuthor,
    requestId: string,
  ): Promise<MessageDto[]> {
    return this.list(await this.requestThread(author, requestId));
  }

  async postToOrder(
    author: MessageAuthor,
    orderId: string,
    dto: CreateMessageDto,
  ): Promise<MessageDto[]> {
    const thread = await this.orderThread(author, orderId);
    await this.post(author, { orderId }, dto);
    return this.list(thread);
  }

  async postToRequest(
    author: MessageAuthor,
    requestId: string,
    dto: CreateMessageDto,
  ): Promise<MessageDto[]> {
    const thread = await this.requestThread(author, requestId);
    await this.post(
      author,
      thread.orderId
        ? { orderId: thread.orderId }
        : { customRequestId: requestId },
      dto,
    );
    return this.list(thread);
  }

  private async post(
    author: MessageAuthor,
    target: { orderId: string } | { customRequestId: string },
    dto: CreateMessageDto,
  ): Promise<void> {
    const body = dto.body?.trim() ?? '';
    const attachments = dto.attachments ?? [];

    if (!body && !attachments.length) {
      throw new BadRequestException('Write a message or attach a file');
    }

    const folder =
      author.role === 'customer'
        ? customerUploadFolder(this.cloudinary, author.id)
        : this.cloudinary.folder();

    if (
      attachments.some((file) => !this.cloudinary.isOwnedAsset(file, folder))
    ) {
      throw new BadRequestException(
        'Attachments must be uploaded with your upload signature',
      );
    }

    if (dto.stageId) {
      const [stage] = await this.db
        .select({ id: productionStages.id })
        .from(productionStages)
        .where(eq(productionStages.id, dto.stageId));

      if (!stage) {
        throw new BadRequestException('Unknown production stage');
      }
    }

    await this.db.insert(messages).values({
      ...target,
      authorId: author.id,
      authorRole: author.role,
      body,
      attachments,
      stageId: dto.stageId ?? null,
    });
  }

  private async list(thread: Thread): Promise<MessageDto[]> {
    const conditions: SQL[] = [];
    if (thread.orderId) conditions.push(eq(messages.orderId, thread.orderId));
    if (thread.requestId) {
      conditions.push(eq(messages.customRequestId, thread.requestId));
    }

    const rows = await this.db.query.messages.findMany({
      where: or(...conditions),
      orderBy: [asc(messages.createdAt)],
      with: { stage: { columns: { id: true, code: true, name: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      authorRole: row.authorRole,
      body: row.body,
      attachments: row.attachments,
      stage: row.stage,
      thread: row.orderId ? 'order' : 'request',
      createdAt: row.createdAt,
    }));
  }

  private async orderThread(
    author: MessageAuthor,
    orderId: string,
  ): Promise<Thread> {
    const [order] = await this.db
      .select({ id: orders.id, requestId: customRequests.id })
      .from(orders)
      .leftJoin(customRequests, eq(customRequests.orderId, orders.id))
      .where(
        and(
          eq(orders.id, orderId),
          author.role === 'customer'
            ? eq(orders.customerId, author.id)
            : undefined,
        ),
      )
      .limit(1);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return { orderId: order.id, requestId: order.requestId };
  }

  private async requestThread(
    author: MessageAuthor,
    requestId: string,
  ): Promise<Thread> {
    const [request] = await this.db
      .select({ id: customRequests.id, orderId: customRequests.orderId })
      .from(customRequests)
      .where(
        and(
          eq(customRequests.id, requestId),
          author.role === 'customer'
            ? eq(customRequests.customerId, author.id)
            : undefined,
        ),
      );

    if (!request) {
      throw new NotFoundException('Custom request not found');
    }

    return { orderId: request.orderId, requestId: request.id };
  }
}
