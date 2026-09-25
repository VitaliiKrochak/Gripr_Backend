import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/app.setup';
import {
  DATABASE,
  Database,
} from '../../src/integrations/database/database.client';
import * as schema from '../../src/integrations/database/database.schema';
import { seedDatabase } from '../../src/integrations/database/database.seed';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import { TelegramGatewayService } from '../../src/integrations/telegram/telegram.gateway.service';
import { TurboSmsService } from '../../src/integrations/turbosms/turbosms.service';

export const TEST_ENV: Record<string, string> = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
  SWAGGER_USERNAME: 'swagger-user',
  SWAGGER_PASSWORD: 'swagger-password',
  FRONTEND_URL: 'https://example.com',
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  SUPABASE_SMS_HOOK_SECRET: `v1,whsec_${Buffer.from('hook-secret').toString('base64')}`,
  TELEGRAM_GATEWAY_TOKEN: 'telegram-token',
  TURBOSMS_TOKEN: 'turbosms-token',
  TURBOSMS_SENDER: 'Jewelry',
  LIQPAY_PUBLIC_KEY: 'liqpay-public',
  LIQPAY_PRIVATE_KEY: 'liqpay-private',
  LIQPAY_SANDBOX: 'true',
  LIQPAY_RESULT_URL: 'https://example.com/checkout/result',
  PUBLIC_API_URL: 'https://api.example.com',
  LIQPAY_RRO_GOOD_ID: '777',
  CLOUDINARY_CLOUD_NAME: 'demo-cloud',
  CLOUDINARY_API_KEY: 'cloudinary-key',
  CLOUDINARY_API_SECRET: 'cloudinary-secret',
  NOVAPOSHTA_API_KEY: 'novaposhta-key',
};

function user(id: string, phone: string, role?: string): User {
  return {
    id,
    phone,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: role ? { role } : {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
}

/** Access tokens accepted by the fake Supabase client, mapped to users. */
export const USERS = {
  admin: user('00000000-0000-4000-8000-000000000001', '380500000001', 'admin'),
  customer: user('00000000-0000-4000-8000-000000000002', '380500000002'),
  otherCustomer: user('00000000-0000-4000-8000-000000000003', '380500000003'),
};

export type TestUser = keyof typeof USERS;

export function cookieFor(testUser: TestUser): string {
  return `access_token=${testUser}`;
}

export interface TestContext {
  app: INestApplication<App>;
  db: Database;
  telegram: { isConfigured: jest.Mock; sendVerificationCode: jest.Mock };
  turboSms: { isConfigured: jest.Mock; sendHybrid: jest.Mock };
  overrides: Map<unknown, unknown>;
  close: () => Promise<void>;
}

export async function createTestApp(
  extraOverrides: Array<[unknown, unknown]> = [],
): Promise<TestContext> {
  Object.assign(process.env, TEST_ENV);

  const client = new PGlite();
  const db = drizzle(client, { schema }) as unknown as Database;
  await migrate(drizzle(client), {
    migrationsFolder: join(__dirname, '../../drizzle'),
  });
  await seedDatabase(db);

  const telegram = {
    isConfigured: jest.fn(() => true),
    sendVerificationCode: jest.fn(() => Promise.resolve()),
  };
  const turboSms = {
    isConfigured: jest.fn(() => true),
    sendHybrid: jest.fn(() => Promise.resolve()),
  };
  const supabase = {
    getUser: (token: string) => {
      const found = USERS[token as TestUser];
      return found
        ? Promise.resolve(found)
        : Promise.reject(new Error('invalid token'));
    },
  };

  const overrides = new Map<unknown, unknown>([
    [DATABASE, db],
    [SupabaseService, supabase],
    [TelegramGatewayService, telegram],
    [TurboSmsService, turboSms],
    ...extraOverrides,
  ]);
  let builder = Test.createTestingModule({ imports: [AppModule] });

  for (const [token, value] of overrides) {
    builder = builder.overrideProvider(token).useValue(value);
  }

  const moduleFixture = await builder.compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>({
    rawBody: true,
  });
  setupApp(app);
  await app.init();

  return {
    app,
    db,
    telegram,
    turboSms,
    overrides,
    close: async () => {
      await app.close();
      await client.close();
    },
  };
}
