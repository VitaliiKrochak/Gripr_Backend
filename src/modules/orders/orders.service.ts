import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import {
  customers,
  customRequests,
  messages,
  orderItems,
  orders,
  orderStatusHistory,
  productionSteps,
  products,
} from '../../integrations/database/database.schema';
import type {
  JewelrySpecification,
  Order,
  OrderStatus,
  SelectedOption,
} from '../../integrations/database/database.schema';
import { qualified } from '../../integrations/database/database.sql';
import { toOffset, toPage } from '../../shared/pagination/pagination';
import { normalizeUkrainianPhone } from '../../shared/phone/ukrainian.phone';
import type { PaginationQueryDto } from '../../shared/pagination/pagination.query.dto';
import { CartService } from '../cart/cart.service';
import { CustomersService } from '../customers/customers.service';
import type { CheckoutDto, OrderContactDto } from './dto/checkout.dto';
import type {
  AdminOrderListQueryDto,
  UpdateOrderDeliveryDto,
  UpdateOrderDto,
} from './dto/order.admin.dto';
import type {
  AdminOrderDto,
  AdminOrderPageDto,
  OrderDto,
  OrderSummaryPageDto,
} from './dto/order.dto';
import { nextPayment } from './order.balance';
import {
  assertTransition,
  CUSTOMER_CANCELLABLE,
  ORDER_TRANSITIONS,
  OrderTransitionError,
  statusAfterPayment,
  statusTimestamps,
} from './order.status';

function customOrderPricing(pricing: CustomOrderInput['pricing']) {
  if (pricing.kind === 'legacy') {
    return {
      status: 'pending_payment' as OrderStatus,
      total: pricing.price,
      depositAmount: pricing.depositAmount,
      modelPaymentAmount: null,
      productionPaymentAmount: null,
    };
  }

  const modelPaymentAmount = pricing.requiresModel ? pricing.modelPrice : 0;
  let status: OrderStatus;

  if (pricing.requiresModel) {
    status = modelPaymentAmount > 0 ? 'awaiting_model_payment' : 'modeling';
  } else {
    status =
      pricing.productionPrepayment > 0
        ? 'awaiting_production_payment'
        : 'in_production';
  }

  return {
    status,
    total: modelPaymentAmount + pricing.productPrice,
    depositAmount: null,
    modelPaymentAmount,
    productionPaymentAmount: pricing.productionPrepayment,
  };
}

/** Legacy quote: optional deposit, then the remainder. */
export interface LegacyCustomPricing {
  kind: 'legacy';
  price: number;
  depositAmount: number | null;
}

/** Proposal: 3D model prepayment, production prepayment, final payment. */
export interface StagedCustomPricing {
  kind: 'staged';
  requiresModel: boolean;
  modelPrice: number;
  productPrice: number;
  productionPrepayment: number;
}

export interface CustomOrderInput {
  customerId: string;
  contact: OrderContactDto & { contactPhone: string };
  productName: string;
  imageUrl: string | null;
  /** Catalog product a customization is based on. */
  productId?: string | null;
  productSlug?: string | null;
  selectedOptions?: SelectedOption[];
  specification?: JewelrySpecification | null;
  pricing: LegacyCustomPricing | StagedCustomPricing;
  productionDaysMin: number;
  productionDaysMax: number;
  changedBy: string;
}

interface TransitionOptions {
  note?: string | null;
  changedBy?: string | null;
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly cart: CartService,
    private readonly customers: CustomersService,
  ) {}

  async checkout(user: User, dto: CheckoutDto): Promise<OrderDto> {
    const contactPhone = this.contactPhone(user, dto.contactPhone);

    const orderId = await this.db.transaction(async (tx) => {
      await this.customers.ensure(user, tx);
      const cart = await this.cart.price(user.id, tx);

      if (!cart.lines.length) {
        throw new BadRequestException('Cart is empty');
      }

      if (cart.hasUnavailableItems) {
        throw new ConflictException(
          'Some cart items are unavailable; review the cart',
        );
      }

      const stock = new Map<string, number>();

      for (const line of cart.lines.filter((l) => l.fromStock)) {
        stock.set(
          line.input.productId,
          (stock.get(line.input.productId) ?? 0) + line.input.quantity,
        );
      }

      for (const [productId, quantity] of stock) {
        const reserved = await tx
          .update(products)
          .set({ stockQuantity: sql`${products.stockQuantity} - ${quantity}` })
          .where(
            and(
              eq(products.id, productId),
              gte(products.stockQuantity, quantity),
            ),
          )
          .returning({ id: products.id });

        if (!reserved.length) {
          throw new ConflictException('Stock has changed; review the cart');
        }
      }

      const [order] = await tx
        .insert(orders)
        .values({
          kind: 'catalog',
          customerId: user.id,
          ...this.contactColumns(dto, contactPhone),
          subtotal: cart.subtotal,
          discount: cart.discount,
          total: cart.total,
          productionDaysMin: cart.productionDaysMin,
          productionDaysMax: cart.productionDaysMax,
        })
        .returning({ id: orders.id });

      await tx.insert(orderItems).values(
        cart.lines.map((line) => ({
          orderId: order.id,
          productId: line.input.productId,
          productSlug: line.product!.slug,
          productName: line.product!.name,
          imageUrl: line.product!.images[0]?.url ?? null,
          selectedOptions: line.configuration!.selectedOptions,
          engravingText: line.configuration!.engravingText,
          fromStock: line.fromStock,
          quantity: line.input.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount,
          lineTotal: line.lineTotal,
          productionDaysMin: line.configuration!.productionDaysMin,
          productionDaysMax: line.configuration!.productionDaysMax,
        })),
      );
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        toStatus: 'pending_payment',
        changedBy: user.id,
      });
      await this.cart.clear(user.id, tx);
      await this.saveDefaults(tx, user.id, dto);

      return order.id;
    });

    return this.getForCustomer(user, orderId);
  }

  /** Creates a single-item custom order from an approved proposal or quote. */
  async createCustomOrder(
    tx: DatabaseExecutor,
    input: CustomOrderInput,
  ): Promise<string> {
    const pricing = customOrderPricing(input.pricing);
    const [order] = await tx
      .insert(orders)
      .values({
        kind: 'custom',
        customerId: input.customerId,
        ...this.contactColumns(input.contact, input.contact.contactPhone),
        status: pricing.status,
        subtotal: pricing.total,
        total: pricing.total,
        depositAmount: pricing.depositAmount,
        modelPaymentAmount: pricing.modelPaymentAmount,
        productionPaymentAmount: pricing.productionPaymentAmount,
        productionDaysMin: input.productionDaysMin,
        productionDaysMax: input.productionDaysMax,
      })
      .returning({ id: orders.id });

    await tx.insert(orderItems).values({
      orderId: order.id,
      productId: input.productId ?? null,
      productSlug: input.productSlug ?? null,
      productName: input.productName,
      imageUrl: input.imageUrl,
      selectedOptions: input.selectedOptions ?? [],
      specification: input.specification ?? null,
      quantity: 1,
      unitPrice: pricing.total,
      lineTotal: pricing.total,
      productionDaysMin: input.productionDaysMin,
      productionDaysMax: input.productionDaysMax,
    });
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      toStatus: pricing.status,
      changedBy: input.changedBy,
    });
    await this.saveDefaults(tx, input.customerId, input.contact);

    return order.id;
  }

  /** The customer approves the 3D model; production prepayment becomes due. */
  async approveModel(user: User, orderId: string): Promise<OrderDto> {
    await this.db.transaction(async (tx) => {
      const order = await this.lockOwnInStatus(
        tx,
        user,
        orderId,
        'model_review',
      );
      await this.applyTransition(tx, order, 'awaiting_production_payment', {
        note: 'Модель погоджено клієнтом',
        changedBy: user.id,
      });
      const awaiting: Order = {
        ...order,
        status: 'awaiting_production_payment',
      };
      const next = statusAfterPayment(awaiting);

      if (next) {
        await this.applyTransition(tx, awaiting, next, {
          note: 'Передоплату за виробництво вже отримано',
          changedBy: user.id,
        });
      }
    });

    return this.getForCustomer(user, orderId);
  }

  /** The customer asks for model changes; the order returns to modeling. */
  async requestModelChanges(
    user: User,
    orderId: string,
    comment: string,
  ): Promise<OrderDto> {
    await this.db.transaction(async (tx) => {
      const order = await this.lockOwnInStatus(
        tx,
        user,
        orderId,
        'model_review',
      );
      await this.applyTransition(tx, order, 'modeling', {
        note: comment,
        changedBy: user.id,
      });
      await tx.insert(messages).values({
        orderId,
        authorId: user.id,
        authorRole: 'customer',
        body: comment,
      });
    });

    return this.getForCustomer(user, orderId);
  }

  private async lockOwnInStatus(
    tx: DatabaseExecutor,
    user: User,
    orderId: string,
    status: OrderStatus,
  ): Promise<Order> {
    const order = await this.lock(tx, orderId);

    if (order.customerId !== user.id) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== status) {
      throw new ConflictException('The order is not waiting for this action');
    }

    return order;
  }

  contactPhone(user: User, requested?: string): string {
    const phone = normalizeUkrainianPhone(requested ?? user.phone ?? '');

    if (!phone) {
      throw new BadRequestException(
        'contactPhone must be a Ukrainian phone number',
      );
    }

    return phone;
  }

  async listForCustomer(
    user: User,
    query: PaginationQueryDto,
  ): Promise<OrderSummaryPageDto> {
    const where = eq(orders.customerId, user.id);
    const [items, [{ total }]] = await Promise.all([
      this.db
        .select(this.summaryColumns())
        .from(orders)
        .where(where)
        .orderBy(desc(orders.createdAt))
        .limit(query.pageSize)
        .offset(toOffset(query)),
      this.db.select({ total: count() }).from(orders).where(where),
    ]);

    return toPage(items, total, query);
  }

  async getForCustomer(user: User, orderId: string): Promise<OrderDto> {
    const order = await this.load(
      and(eq(orders.id, orderId), eq(orders.customerId, user.id))!,
    );

    return this.toCustomerDto(order);
  }

  async cancelByCustomer(user: User, orderId: string): Promise<OrderDto> {
    await this.db.transaction(async (tx) => {
      const order = await this.lock(tx, orderId);

      if (order.customerId !== user.id) {
        throw new NotFoundException('Order not found');
      }

      if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
        throw new ConflictException(
          'The order can no longer be cancelled online; contact us',
        );
      }

      await this.applyTransition(tx, order, 'cancelled', {
        note: 'Скасовано клієнтом',
        changedBy: user.id,
      });
    });

    return this.getForCustomer(user, orderId);
  }

  async list(query: AdminOrderListQueryDto): Promise<AdminOrderPageDto> {
    const conditions: SQL[] = [];

    if (query.status) conditions.push(eq(orders.status, query.status));
    if (query.kind) conditions.push(eq(orders.kind, query.kind));
    if (query.createdFrom) {
      conditions.push(gte(orders.createdAt, query.createdFrom));
    }
    if (query.createdTo) {
      conditions.push(lt(orders.createdAt, query.createdTo));
    }
    if (query.q) {
      const q = query.q.trim();
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(orders.contactPhone, pattern),
          ilike(orders.contactName, pattern),
          /^\d{1,9}$/.test(q) ? eq(orders.number, Number(q)) : undefined,
        )!,
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const [items, [{ total }]] = await Promise.all([
      this.db
        .select({
          ...this.summaryColumns(),
          contactName: orders.contactName,
          contactPhone: orders.contactPhone,
        })
        .from(orders)
        .where(where)
        .orderBy(desc(orders.createdAt))
        .limit(query.pageSize)
        .offset(toOffset(query)),
      this.db.select({ total: count() }).from(orders).where(where),
    ]);

    return toPage(items, total, query);
  }

  async get(orderId: string): Promise<AdminOrderDto> {
    const order = await this.load(eq(orders.id, orderId));

    return {
      ...order,
      nextPayment: nextPayment(order),
      allowedTransitions: [...ORDER_TRANSITIONS[order.status]],
    };
  }

  async changeStatus(
    orderId: string,
    to: OrderStatus,
    options: TransitionOptions,
  ): Promise<AdminOrderDto> {
    await this.db.transaction(async (tx) => {
      await this.transition(tx, orderId, to, options);
    });

    return this.get(orderId);
  }

  async updateDelivery(
    orderId: string,
    dto: UpdateOrderDeliveryDto,
  ): Promise<AdminOrderDto> {
    await this.updateColumns(orderId, dto);
    return this.get(orderId);
  }

  async update(orderId: string, dto: UpdateOrderDto): Promise<AdminOrderDto> {
    await this.updateColumns(orderId, dto);
    return this.get(orderId);
  }

  /** Moves an order to `to` inside the caller's transaction. */
  async transition(
    tx: DatabaseExecutor,
    orderId: string,
    to: OrderStatus,
    options: TransitionOptions = {},
  ): Promise<void> {
    await this.applyTransition(tx, await this.lock(tx, orderId), to, options);
  }

  /**
   * Adds a successful payment to the order balance and advances an order
   * that was waiting for it. Runs inside the caller's transaction.
   */
  async applyPayment(
    tx: DatabaseExecutor,
    orderId: string,
    amount: number,
    changedBy: string | null = null,
  ): Promise<void> {
    const [order] = await tx
      .update(orders)
      .set({ paidAmount: sql`${orders.paidAmount} + ${amount}` })
      .where(eq(orders.id, orderId))
      .returning();
    const next = statusAfterPayment(order);

    if (next) {
      await this.applyTransition(tx, order, next, {
        note: 'Оплату отримано',
        changedBy,
      });
    }
  }

  async lock(tx: DatabaseExecutor, orderId: string): Promise<Order> {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for('update');

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  private async applyTransition(
    tx: DatabaseExecutor,
    order: Order,
    to: OrderStatus,
    { note = null, changedBy = null }: TransitionOptions,
  ): Promise<void> {
    try {
      assertTransition(order, to);
    } catch (error) {
      if (error instanceof OrderTransitionError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }

    await tx
      .update(orders)
      .set({ status: to, ...statusTimestamps(to) })
      .where(eq(orders.id, order.id));
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: to,
      note,
      changedBy,
    });

    if (to === 'cancelled') {
      await this.restock(tx, order.id);
    }
  }

  private async restock(tx: DatabaseExecutor, orderId: string): Promise<void> {
    const items = await tx
      .select({
        productId: orderItems.productId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(
        and(eq(orderItems.orderId, orderId), eq(orderItems.fromStock, true)),
      );

    for (const item of items) {
      if (item.productId) {
        await tx
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
          })
          .where(eq(products.id, item.productId));
      }
    }
  }

  private async updateColumns(
    orderId: string,
    values: Partial<typeof orders.$inferInsert>,
  ): Promise<void> {
    if (!Object.keys(values).length) {
      await this.get(orderId);
      return;
    }

    const [row] = await this.db
      .update(orders)
      .set(values)
      .where(eq(orders.id, orderId))
      .returning({ id: orders.id });

    if (!row) {
      throw new NotFoundException('Order not found');
    }
  }

  private async saveDefaults(
    tx: DatabaseExecutor,
    customerId: string,
    dto: OrderContactDto,
  ): Promise<void> {
    if (!dto.saveAsDefault) {
      return;
    }

    await tx
      .update(customers)
      .set({
        deliveryCityRef: dto.delivery.cityRef,
        deliveryCityName: dto.delivery.cityName,
        deliveryWarehouseRef: dto.delivery.warehouseRef,
        deliveryWarehouseName: dto.delivery.warehouseName,
      })
      .where(eq(customers.id, customerId));
  }

  private contactColumns(dto: OrderContactDto, contactPhone: string) {
    return {
      contactName: dto.contactName,
      contactPhone,
      contactEmail: dto.contactEmail ?? null,
      deliveryCityRef: dto.delivery.cityRef,
      deliveryCityName: dto.delivery.cityName,
      deliveryWarehouseRef: dto.delivery.warehouseRef,
      deliveryWarehouseName: dto.delivery.warehouseName,
      customerComment: dto.comment ?? null,
    };
  }

  private summaryColumns() {
    return {
      id: orders.id,
      number: orders.number,
      kind: orders.kind,
      status: orders.status,
      total: orders.total,
      paidAmount: orders.paidAmount,
      itemCount: sql<number>`(select coalesce(sum(${qualified(orderItems.quantity)}), 0)::int from ${orderItems} where ${qualified(orderItems.orderId)} = ${qualified(orders.id)})`,
      productionDaysMax: orders.productionDaysMax,
      createdAt: orders.createdAt,
    };
  }

  private async load(where: SQL) {
    const order = await this.db.query.orders.findFirst({
      where,
      with: {
        customer: {
          columns: { id: true, phone: true, firstName: true, lastName: true },
        },
        items: {
          orderBy: [asc(orderItems.createdAt), asc(orderItems.productName)],
          with: {
            productionSteps: {
              orderBy: [asc(productionSteps.sortOrder)],
              with: {
                stage: {
                  columns: {
                    id: true,
                    code: true,
                    name: true,
                    description: true,
                  },
                },
              },
            },
          },
        },
        history: { orderBy: (history) => [asc(history.createdAt)] },
        payments: { orderBy: (payments) => [asc(payments.createdAt)] },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const [request] = await this.db
      .select({ id: customRequests.id })
      .from(customRequests)
      .where(eq(customRequests.orderId, order.id))
      .limit(1);

    return { ...order, customRequestId: request?.id ?? null };
  }

  private toCustomerDto(
    order: Awaited<ReturnType<OrdersService['load']>>,
  ): OrderDto {
    const { customer, customerId, adminNote, ...rest } = order;

    return {
      ...rest,
      nextPayment: nextPayment(order),
      items: order.items.map((item) => ({
        ...item,
        productionSteps: item.productionSteps
          .filter((step) => step.visibleToCustomer)
          .map((step) => ({
            id: step.id,
            stage: step.stage,
            state: step.state,
            note: step.note,
            images: step.images,
            startedAt: step.startedAt,
            completedAt: step.completedAt,
          })),
      })),
      history: order.history.map((change) => ({
        fromStatus: change.fromStatus,
        toStatus: change.toStatus,
        note: change.note,
        createdAt: change.createdAt,
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        type: payment.type,
        status: payment.status,
        amount: payment.amount,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt,
      })),
    };
  }
}
