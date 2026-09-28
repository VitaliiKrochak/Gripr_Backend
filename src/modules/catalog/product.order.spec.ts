import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { products } from '../../integrations/database/database.schema';
import { defaultProductOrder, ownProductsFirst } from './product.order';

const dialect = new PgDialect();
const render = (order: SQL[]) =>
  dialect.sqlToQuery(sql.join(order, sql`, `)).sql;

describe('product order', () => {
  it('puts own products before open models for any sort', () => {
    const rendered = render(ownProductsFirst([sql`${products.basePrice} asc`]));

    expect(rendered).toMatch(
      /^exists \(select 1 from "app"\."design_candidates" where "design_candidates"\."product_id" = "products"\."id"\) asc, "app"\."products"\."base_price" asc$/,
    );
  });

  it('orders open models by popularity before the manual position', () => {
    const rendered = render(defaultProductOrder());
    const flag = rendered.indexOf(') asc');
    const popularity = rendered.indexOf('"popularity_score"');
    const position = rendered.indexOf('"sort_order" asc');

    expect(flag).toBeGreaterThan(0);
    expect(popularity).toBeGreaterThan(flag);
    expect(position).toBeGreaterThan(popularity);
    expect(rendered).toContain('desc nulls last');
  });
});
