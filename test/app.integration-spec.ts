import { Test, TestingModule } from '@nestjs/testing';
import type { OpenAPIObject } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupApp } from './../src/app.setup';
import { SupabaseService } from './../src/integrations/supabase/supabase.service';

describe('AppModule (integration)', () => {
  let app: INestApplication<App>;
  const getUser = jest.fn();
  const refreshSession = jest.fn();
  const signUp = jest.fn();
  const signInWithPassword = jest.fn();
  const signOut = jest.fn();
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
    process.env.SUPABASE_SECRET_KEY = 'test-secret-key';
    process.env.SWAGGER_USERNAME = 'swagger-user';
    process.env.SWAGGER_PASSWORD = 'swagger-password';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        getUser,
        refreshSession,
        signUp,
        signInWithPassword,
        signOut,
      })
      .compile();

    signInWithPassword.mockResolvedValue({
      user: { id: 'supabase-user-id' },
      session: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: expiresAt,
      },
    });
    signUp.mockResolvedValue({
      user: { id: 'new-supabase-user-id' },
      session: null,
    });
    refreshSession.mockResolvedValue({
      user: { id: 'supabase-user-id' },
      session: {
        access_token: 'rotated-access-token',
        refresh_token: 'rotated-refresh-token',
        expires_at: expiresAt,
      },
    });
    signOut.mockResolvedValue(undefined);

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    getUser.mockResolvedValue({
      id: 'supabase-user-id',
      app_metadata: {},
    });
  });

  it('exposes public health without authentication', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('clears auth cookies when the access token is missing or expired', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-out')
      .expect(204);

    expect(signOut).not.toHaveBeenCalled();
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=;'),
        expect.stringContaining('refresh_token=;'),
      ]),
    );
  });

  it('sets HttpOnly cookies without exposing tokens after sign-in', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email: 'user@example.com', password: 'password' })
      .expect(200)
      .expect({
        userId: 'supabase-user-id',
        expiresAt,
      });

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=access-token'),
        expect.stringContaining('refresh_token=refresh-token'),
        expect.stringContaining('HttpOnly'),
      ]),
    );
    expect(response.body).not.toHaveProperty('accessToken');
    expect(response.body).not.toHaveProperty('refreshToken');
  });

  it('clears stale auth cookies when sign-up does not create a session', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up')
      .set(
        'Cookie',
        'access_token=previous-access-token; refresh_token=previous-refresh-token',
      )
      .send({ email: 'new-user@example.com', password: 'password' })
      .expect(201)
      .expect({ userId: 'new-supabase-user-id', expiresAt: null });

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=;'),
        expect.stringContaining('refresh_token=;'),
      ]),
    );
  });

  it('rotates auth cookies using the refresh-token cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=current-refresh-token')
      .expect(200)
      .expect({ userId: 'supabase-user-id', expiresAt });

    expect(refreshSession).toHaveBeenCalledWith('current-refresh-token');
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=rotated-access-token'),
        expect.stringContaining('refresh_token=rotated-refresh-token'),
      ]),
    );
  });

  it('clears both auth cookies on sign-out', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-out')
      .set('Cookie', 'access_token=user-token')
      .expect(204);

    expect(signOut).toHaveBeenCalledWith('user-token');
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=;'),
        expect.stringContaining('refresh_token=;'),
      ]),
    );
  });

  it('publishes Swagger paths and cookie security schemes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .auth('swagger-user', 'swagger-password')
      .expect(200);
    const document = response.body as OpenAPIObject;

    expect(document.paths).toHaveProperty('/api/auth/sign-up');
    expect(document.paths).toHaveProperty('/api/auth/sign-in');
    expect(document.paths).toHaveProperty('/api/auth/refresh');
    expect(document.paths).toHaveProperty('/api/auth/sign-out');
    expect(document.paths).toHaveProperty('/api/health');
    expect(
      document.components?.securitySchemes?.['access-token'],
    ).toMatchObject({
      in: 'cookie',
      name: 'access_token',
    });
    expect(
      document.components?.securitySchemes?.['refresh-token'],
    ).toMatchObject({
      in: 'cookie',
      name: 'refresh_token',
    });
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
