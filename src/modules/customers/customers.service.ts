import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { count, desc, eq, getTableColumns, ilike, or, sql } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import { customers, orders } from '../../integrations/database/database.schema';
import type { Customer } from '../../integrations/database/database.schema';
import { qualified } from '../../integrations/database/database.sql';
import { toOffset, toPage } from '../../shared/pagination/pagination';
import { normalizeUkrainianPhone } from '../../shared/phone/ukrainian.phone';
import type {
  CustomerDetailsDto,
  CustomerListQueryDto,
  CustomerPageDto,
} from './customer.admin.dto';
import type { UpdateCustomerDto } from './customer.dto';

@Injectable()
export class CustomersService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Returns the customer profile for a Supabase user, creating it on first
   * use. Must be called before writing rows that reference the customer.
   */
  async ensure(user: User, executor: DatabaseExecutor = this.db) {
    const phone = user.phone ? normalizeUkrainianPhone(user.phone) : null;
    const [customer] = await executor
      .insert(customers)
      .values({ id: user.id, phone })
      .onConflictDoUpdate({
        target: customers.id,
        set: { phone: sql`coalesce(excluded.phone, ${customers.phone})` },
      })
      .returning();

    return customer;
  }

  async update(user: User, dto: UpdateCustomerDto): Promise<Customer> {
    await this.ensure(user);
    const [customer] = await this.db
      .update(customers)
      .set(dto)
      .where(eq(customers.id, user.id))
      .returning();

    return customer;
  }

  async list(query: CustomerListQueryDto): Promise<CustomerPageDto> {
    const pattern = query.q ? `%${query.q.trim()}%` : undefined;
    const where = pattern
      ? or(
          ilike(customers.phone, pattern),
          ilike(customers.firstName, pattern),
          ilike(customers.lastName, pattern),
          ilike(customers.email, pattern),
        )
      : undefined;

    const [items, [{ total }]] = await Promise.all([
      this.db
        .select({ ...getTableColumns(customers), ...this.statsColumns() })
        .from(customers)
        .where(where)
        .orderBy(desc(customers.createdAt))
        .limit(query.pageSize)
        .offset(toOffset(query)),
      this.db.select({ total: count() }).from(customers).where(where),
    ]);

    return toPage(items, total, query);
  }

  async get(id: string): Promise<CustomerDetailsDto> {
    const [customer] = await this.db
      .select({ ...getTableColumns(customers), ...this.statsColumns() })
      .from(customers)
      .where(eq(customers.id, id));

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const customerOrders = await this.db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        total: orders.total,
        paidAmount: orders.paidAmount,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.customerId, id))
      .orderBy(desc(orders.createdAt));

    return { ...customer, orders: customerOrders };
  }

  private statsColumns() {
    return {
      orderCount: sql<number>`(select count(*)::int from ${orders} where ${qualified(orders.customerId)} = ${qualified(customers.id)})`,
      totalPaid: sql<number>`(select coalesce(sum(${qualified(orders.paidAmount)}), 0)::int from ${orders} where ${qualified(orders.customerId)} = ${qualified(customers.id)})`,
    };
  }
}
