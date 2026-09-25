import request from 'supertest';
import { NovaPoshtaService } from '../src/integrations/novaposhta/novaposhta.service';
import { CatalogFixture, createCatalog } from './support/catalog.fixtures';
import { placeOrder } from './support/order.fixtures';
import {
  cookieFor,
  createTestApp,
  TestContext,
  USERS,
} from './support/test.app';

describe('Delivery lookup and admin dashboard (e2e)', () => {
  let context: TestContext;
  let catalog: CatalogFixture;
  const novaPoshta = {
    searchCities: jest.fn(),
    searchWarehouses: jest.fn(),
  };
  const customer = cookieFor('customer');
  const admin = cookieFor('admin');

  beforeAll(async () => {
    context = await createTestApp([[NovaPoshtaService, novaPoshta]]);
    catalog = await createCatalog(context.app.getHttpServer());
  });

  afterAll(async () => {
    await context.close();
  });

  const server = () => context.app.getHttpServer();

  it('looks up Nova Poshta cities and warehouses for signed-in customers', async () => {
    const city = {
      ref: 'city-1',
      name: 'Київ',
      settlementType: 'місто',
      area: 'Київська',
    };
    novaPoshta.searchCities.mockResolvedValue([city]);
    novaPoshta.searchWarehouses.mockResolvedValue([]);

    await request(server()).get('/api/delivery/cities?q=Ки').expect(401);
    await request(server())
      .get('/api/delivery/cities?q=К')
      .set('Cookie', customer)
      .expect(400);

    const cities = await request(server())
      .get('/api/delivery/cities')
      .query({ q: 'Ки' })
      .set('Cookie', customer)
      .expect(200);
    expect(cities.body).toEqual([city]);

    await request(server())
      .get('/api/delivery/warehouses')
      .query({ cityRef: 'city-1', q: '12' })
      .set('Cookie', customer)
      .expect(200);
    expect(novaPoshta.searchWarehouses).toHaveBeenCalledWith('city-1', '12');

    novaPoshta.searchCities.mockRejectedValueOnce(new Error('down'));
    await request(server())
      .get('/api/delivery/cities?q=Льв')
      .set('Cookie', customer)
      .expect(503);
  });

  it('summarises orders, revenue, and catalog health for admins', async () => {
    const order = await placeOrder(server(), catalog.earrings.id);
    await request(server())
      .post(`/api/orders/${order.id}/payments`)
      .set('Cookie', admin)
      .send({ amount: order.total })
      .expect(201);
    await placeOrder(server(), catalog.ring.id);

    await request(server())
      .get('/api/dashboard/summary')
      .set('Cookie', customer)
      .expect(403);

    const summary = await request(server())
      .get('/api/dashboard/summary')
      .set('Cookie', admin)
      .expect(200);
    expect(summary.body).toMatchObject({
      ordersByStatus: { paid: 1, pending_payment: 1, cancelled: 0 },
      revenue: { total: order.total, last30Days: order.total },
      newCustomRequests: 0,
      publishedProducts: 2,
      lowStockProducts: 1,
      customers: 1,
    });

    const recent = await request(server())
      .get('/api/orders')
      .query({ createdFrom: new Date(Date.now() - 60_000).toISOString() })
      .set('Cookie', admin)
      .expect(200);
    expect(recent.body.total).toBe(2);
    const future = await request(server())
      .get('/api/orders')
      .query({ createdFrom: new Date(Date.now() + 60_000).toISOString() })
      .set('Cookie', admin)
      .expect(200);
    expect(future.body.total).toBe(0);

    const customers = await request(server())
      .get('/api/customers')
      .set('Cookie', admin)
      .expect(200);
    expect(customers.body.items).toEqual([
      expect.objectContaining({
        id: USERS.customer.id,
        orderCount: 2,
        totalPaid: order.total,
      }),
    ]);
  });
});
