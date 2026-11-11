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
import { nextPayment } from '../orders/order.balance';
import { orderReference } from '../orders/order.reference';
import { OrdersService } from '../orders/orders.service';
import type { ManualPaymentDto, PaymentCheckoutDto } from './payment.dto';
import { PAYMENT_PROVIDER } from './payment.provider';
import type { PaymentProvider } from './payment.provider';
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
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly orders: OrdersService,
  ) {}

  /**
   * Starts an online payment for whatever the order currently expects,
   * into the account of the order's store.
   */
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

    if (!this.provider.isAvailable(order.store)) {
      throw new ConflictException(
        'Online payment is not set up for this store yet',
      );
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
      .values({
        orderId,
        type: due.type,
        amount: due.amount,
        merchant: order.store,
        provider: this.provider.name,
      })
      .returning();

    return {
      paymentId: payment.id,
      type: payment.type,
      amount: payment.amount,
      ...this.provider.startPayment(payment.merchant, {
        paymentId: payment.id,
        orderId,
        amount: payment.amount,
        description: `${PAYMENT_LABELS[due.type]} замовлення ${orderReference(order.store, order.number)}`,
        receipt: {
          lines: receiptLines(payment.amount, items),
          emails: order.contactEmail ? [order.contactEmail] : [],
        },
      }),
    };
  }

  /**
   * Applies a verified provider callback; safe to receive repeatedly. The
   * account that signed it must be the one the payment was started with.
   */
  async handleCallback(data: string, signature: string): Promise<void> {
    const callback = this.provider.verifyCallback(data, signature);

    if (!callback) {
      throw new BadRequestException('Invalid signature');
    }

    await this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, callback.paymentId))
        .for('update');

      if (!payment) {
        this.logger.warn(`Callback for unknown payment ${callback.paymentId}`);
        return;
      }

      if (
        payment.merchant !== callback.merchant ||
        payment.provider !== this.provider.name
      ) {
        this.logger.error(
          `Payment ${payment.id} of ${payment.merchant} got a callback signed by ${callback.merchant}`,
        );
        throw new BadRequestException(
          'The callback does not belong to this payment account',
        );
      }

      let { outcome } = callback;

      if (outcome === 'success' && callback.amount !== payment.amount) {
        this.logger.error(
          `Payment ${payment.id} amount mismatch: ${callback.amount ?? 'non-UAH'}`,
        );
        outcome = 'failure';
      }

      const status = nextPaymentStatus(payment.status, outcome);

      await tx
        .update(payments)
        .set({
          providerStatus: callback.providerStatus,
          providerPaymentId:
            callback.providerPaymentId ?? payment.providerPaymentId,
          rawCallback: callback.raw,
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

  /** Records money received outside online payments, for the order's store. */
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
        merchant: order.store,
        status: 'success',
        amount: dto.amount,
        note: dto.note,
        paidAt: new Date(),
      });
      await this.orders.applyPayment(tx, orderId, dto.amount, adminId);
    });
  }
}
