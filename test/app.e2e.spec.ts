import { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupApp } from './../src/app.setup';

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
    process.env.SWAGGER_USERNAME = 'swagger-user';
    process.env.SWAGGER_PASSWORD = 'swagger-password';
    process.env.FRONTEND_URL = 'https://example.com';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  it('exposes public health without authentication', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('publishes only operation endpoints in Swagger', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .auth('swagger-user', 'swagger-password')
      .expect(200);
    const document = response.body as OpenAPIObject;

    expect(document.paths).toHaveProperty('/api/health');
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
    await request(app.getHttpServer())
      .get('/api/docs')
      .expect('WWW-Authenticate', 'Basic realm="Swagger"')
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/docs-json')
      .auth('swagger-user', 'wrong-password')
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
