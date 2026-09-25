import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { createTestApp, TestContext } from './support/test.app';

describe('AppModule (e2e)', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestApp();
  });

  afterAll(async () => {
    await context.close();
  });

  it('exposes public health without authentication', () => {
    return request(context.app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('publishes only operation endpoints in Swagger', async () => {
    const response = await request(context.app.getHttpServer())
      .get('/api/docs-json')
      .auth('swagger-user', 'swagger-password')
      .expect(200);
    const document = response.body as OpenAPIObject;

    expect(document.paths).toHaveProperty('/api/health');
    expect(document.paths).toHaveProperty('/api/storefront/products');
    expect(document.paths).not.toHaveProperty('/api/auth/sign-in');
    expect(document.paths).not.toHaveProperty('/api/auth/sign-up');
    expect(
      document.components?.securitySchemes?.['access-token'],
    ).toMatchObject({
      in: 'cookie',
      name: 'access_token',
    });
    expect(document.components?.securitySchemes).not.toHaveProperty(
      'refresh-token',
    );
  });

  it('protects Swagger with its own username and password', async () => {
    await request(context.app.getHttpServer())
      .get('/api/docs')
      .expect('WWW-Authenticate', 'Basic realm="Swagger"')
      .expect(401);

    await request(context.app.getHttpServer())
      .get('/api/docs-json')
      .auth('swagger-user', 'wrong-password')
      .expect(401);
  });
});
