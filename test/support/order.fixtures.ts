import request from 'supertest';
import { App } from 'supertest/types';
import { cookieFor, TestUser } from './test.app';

export const DELIVERY = {
  cityRef: 'city-ref',
  cityName: 'Київ',
  warehouseRef: 'warehouse-ref',
  warehouseName: 'Відділення №1',
};

/** Adds a product with default options to the cart and checks out. */
export async function placeOrder(
  server: App,
  productId: string,
  user: TestUser = 'customer',
): Promise<{ id: string; total: number }> {
  const cookie = cookieFor(user);

  await request(server)
    .post('/api/customers/me/cart/items')
    .set('Cookie', cookie)
    .send({ productId })
    .expect(200);
  const response = await request(server)
    .post('/api/customers/me/orders')
    .set('Cookie', cookie)
    .send({ contactName: 'Олена', delivery: DELIVERY })
    .expect(201);

  return response.body as { id: string; total: number };
}
