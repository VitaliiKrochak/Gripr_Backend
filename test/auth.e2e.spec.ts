import { createHmac } from 'node:crypto';
import request from 'supertest';
import { cookieFor, createTestApp, TestContext } from './support/test.app';

describe('Auth and customers (e2e)', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestApp();
  });

  afterAll(async () => {
    await context.close();
  });

  function signedHook(body: object) {
    const raw = JSON.stringify(body);
    const id = 'msg_1';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', Buffer.from('hook-secret'))
      .update(`${id}.${timestamp}.${raw}`)
      .digest('base64');

    return request(context.app.getHttpServer())
      .post('/api/auth/sms-hook')
      .set('Content-Type', 'application/json')
      .set('webhook-id', id)
      .set('webhook-timestamp', timestamp)
      .set('webhook-signature', `v1,${signature}`)
      .send(raw);
  }

  it('delivers the Supabase OTP through Telegram', async () => {
    await signedHook({
      user: { id: 'u1', phone: '380501234567' },
      sms: { otp: '123456' },
    })
      .expect(200)
      .expect({});

    expect(context.telegram.sendVerificationCode).toHaveBeenCalledWith(
      '+380501234567',
      '123456',
      300,
    );
  });

  it('rejects non-Ukrainian phone numbers in the Supabase error format', async () => {
    const response = await signedHook({
      user: { phone: '48501234567' },
      sms: { otp: '123456' },
    }).expect(400);

    expect(response.body).toEqual({
      error: {
        http_code: 400,
        message: 'Only Ukrainian phone numbers (+380) are supported',
      },
    });
  });

  it('rejects unsigned hook calls', async () => {
    await request(context.app.getHttpServer())
      .post('/api/auth/sms-hook')
      .send({ user: { phone: '380501234567' }, sms: { otp: '123456' } })
      .expect(401);
  });

  it('creates the customer profile lazily and updates it', async () => {
    const server = context.app.getHttpServer();

    await request(server).get('/api/customers/me').expect(401);

    const created = await request(server)
      .get('/api/customers/me')
      .set('Cookie', cookieFor('customer'))
      .expect(200);
    expect(created.body).toMatchObject({
      id: '00000000-0000-4000-8000-000000000002',
      phone: '380500000002',
      firstName: null,
    });

    await request(server)
      .patch('/api/customers/me')
      .set('Cookie', cookieFor('customer'))
      .send({ firstName: 'Олена', ringSize: 17.5 })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          firstName: 'Олена',
          ringSize: 17.5,
        });
      });
  });

  it('lets only administrators list customers', async () => {
    const server = context.app.getHttpServer();

    await request(server)
      .get('/api/customers')
      .set('Cookie', cookieFor('customer'))
      .expect(403);

    const response = await request(server)
      .get('/api/customers?q=Олена')
      .set('Cookie', cookieFor('admin'))
      .expect(200);
    expect(response.body).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      items: [{ firstName: 'Олена', orderCount: 0, totalPaid: 0 }],
    });
  });
});
