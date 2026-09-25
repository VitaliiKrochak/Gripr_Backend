import { ApiProperty } from '@nestjs/swagger';
import { ORDER_STATUSES } from '../../integrations/database/database.schema';
import type { OrderStatus } from '../../integrations/database/database.schema';

export class RevenueDto {
  /** Successful, non-reversed payments in kopiykas. */
  total: number;
  /** Same, for payments received in the last 30 days. */
  last30Days: number;
}

export class DashboardSummaryDto {
  @ApiProperty({
    description: 'Number of orders in each status',
    type: 'object',
    properties: Object.fromEntries(
      ORDER_STATUSES.map((status) => [status, { type: 'integer' }]),
    ),
  })
  ordersByStatus: Record<OrderStatus, number>;
  revenue: RevenueDto;
  /** Custom requests waiting for a first response. */
  newCustomRequests: number;
  publishedProducts: number;
  /** Published in-stock products with at most one piece left. */
  lowStockProducts: number;
  customers: number;
}
