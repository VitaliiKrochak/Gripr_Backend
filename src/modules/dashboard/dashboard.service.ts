import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, lte, sql } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  customers,
  customRequests,
  ORDER_STATUSES,
  orders,
  payments,
  products,
} from '../../integrations/database/database.schema';
import type { OrderStatus } from '../../integrations/database/database.schema';
import type { DashboardSummaryDto } from './dashboard.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async summary(now = new Date()): Promise<DashboardSummaryDto> {
    const since = new Date(now.getTime() - 30 * DAY_MS);
    const [
      statusCounts,
      [revenue],
      [{ newCustomRequests }],
      [{ publishedProducts }],
      [{ lowStockProducts }],
      [{ customerCount }],
    ] = await Promise.all([
      this.db
        .select({ status: orders.status, total: count() })
        .from(orders)
        .groupBy(orders.status),
      this.db
        .select({
          total: sql<number>`coalesce(sum(${payments.amount}), 0)::int`,
          last30Days: sql<number>`coalesce(sum(${payments.amount}) filter (where ${payments.paidAt} >= ${since.toISOString()}), 0)::int`,
        })
        .from(payments)
        .where(eq(payments.status, 'success')),
      this.db
        .select({ newCustomRequests: count() })
        .from(customRequests)
        .where(eq(customRequests.status, 'new')),
      this.db
        .select({ publishedProducts: count() })
        .from(products)
        .where(eq(products.status, 'published')),
      this.db
        .select({ lowStockProducts: count() })
        .from(products)
        .where(
          and(
            eq(products.status, 'published'),
            eq(products.availability, 'in_stock'),
            lte(products.stockQuantity, 1),
          ),
        ),
      this.db.select({ customerCount: count() }).from(customers),
    ]);

    const ordersByStatus = Object.fromEntries(
      ORDER_STATUSES.map((status) => [status, 0]),
    ) as Record<OrderStatus, number>;

    for (const row of statusCounts) {
      ordersByStatus[row.status] = row.total;
    }

    return {
      ordersByStatus,
      revenue: { total: revenue.total, last30Days: revenue.last30Days },
      newCustomRequests,
      publishedProducts,
      lowStockProducts,
      customers: customerCount,
    };
  }
}
