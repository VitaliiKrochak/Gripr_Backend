import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { and, eq, sql } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  orderItems,
  orders,
  payments,
} from '../../integrations/database/database.schema';
import { LiqPayService } from '../../integrations/liqpay/liqpay.service';
import { nextPayment } from '../orders/order.balance';
import { OrdersService } from '../orders/orders.service';
import type { ManualPaymentDto, PaymentCheckoutDto } from './payment.dto';
import { receiptLines } from './payment.receipt';
import { nextPaymentStatus } from './payment.status';

const PAYMENT_LABELS = {
  full: 'Оплата',
  deposit: 'Передоплата',
  model_prepayment: 'Передоплата 3D-моделі',
  production_prepayment: 'Передоплата виготовлення',
  remainder: 'Доплата',
} as const;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly liqPay: LiqPayService,
    private readonly orders: OrdersService,
  ) {}

  /** Starts a LiqPay payment for whatever the order currently expects. */
  async createCheckout(
    user: User,
    orderId: string,
  ): Promise<PaymentCheckoutDto> {
    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, user.id)));

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const due = nextPayment(order);

    if (!due) {
      throw new ConflictException('Nothing to pay for this order');
    }

    const items =
      due.type === 'full'
        ? await this.db
            .select({
              quantity: orderItems.quantity,
              lineTotal: orderItems.lineTotal,
            })
            .from(orderItems)
            .where(eq(orderItems.orderId, orderId))
        : null;
    const [payment] = await this.db
      .insert(payments)
      .values({ orderId, type: due.type, amount: due.amount })
      .returning();

    return {
      paymentId: payment.id,
      type: payment.type,
      amount: payment.amount,
      ...this.liqPay.createCheckout({
        paymentId: payment.id,
        orderId,
        amount: payment.amount,
        description: `${PAYMENT_LABELS[due.type]} замовлення №${order.number}`,
        receipt: {
          lines: receiptLines(payment.amount, items),
          emails: order.contactEmail ? [order.contactEmail] : [],
        },
      }),
    };
  }

  /** Applies a verified LiqPay callback; safe to receive repeatedly. */
  async handleLiqPayCallback(data: string, signature: string): Promise<void> {
    const callback = this.liqPay.parseCallback(data, signature);

    if (!callback) {
      throw new BadRequestException('Invalid signature');
    }

    await this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, callback.order_id))
        .for('update');

      if (!payment) {
        this.logger.warn(`Callback for unknown payment ${callback.order_id}`);
        return;
      }

      let outcome = this.liqPay.outcome(callback.status);
      const amountMatches =
        callback.currency === 'UAH' &&
        Math.round(Number(callback.amount) * 100) === payment.amount;

      if (outcome === 'success' && !amountMatches) {
        this.logger.error(
          `Payment ${payment.id} amount mismatch: ${callback.amount} ${callback.currency}`,
        );
        outcome = 'failure';
      }

      const status = nextPaymentStatus(payment.status, outcome);

      await tx
        .update(payments)
        .set({
          providerStatus: callback.status,
          providerPaymentId:
            callback.payment_id !== undefined
              ? String(callback.payment_id)
              : payment.providerPaymentId,
          rawCallback: callback,
          ...(status ? { status } : {}),
          ...(status === 'success' ? { paidAt: new Date() } : {}),
        })
        .where(eq(payments.id, payment.id));

      if (status === 'success') {
        await this.orders.applyPayment(tx, payment.orderId, payment.amount);
      }

      if (status === 'reversed') {
        await tx
          .update(orders)
          .set({ paidAmount: sql`${orders.paidAmount} - ${payment.amount}` })
          .where(eq(orders.id, payment.orderId));
      }
    });
  }

  /** Records money received outside LiqPay. */
  async recordManual(
    orderId: string,
    dto: ManualPaymentDto,
    adminId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const order = await this.orders.lock(tx, orderId);

      if (order.status === 'cancelled' || order.status === 'refunded') {
        throw new ConflictException('The order is closed');
      }

      await tx.insert(payments).values({
        orderId,
        type: 'manual',
        status: 'success',
        amount: dto.amount,
        note: dto.note,
        paidAt: new Date(),
      });
      await this.orders.applyPayment(tx, orderId, dto.amount, adminId);
    });
  }
}
