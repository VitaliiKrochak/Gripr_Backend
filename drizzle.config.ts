import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/integrations/database/schema/*.schema.ts',
  out: './drizzle',
  schemaFilter: ['app'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
