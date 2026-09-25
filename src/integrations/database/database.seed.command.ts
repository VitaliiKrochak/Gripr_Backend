import { existsSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseConfig } from './database.config';
import * as schema from './database.schema';
import { seedDatabase } from './database.seed';

async function run(): Promise<void> {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  const client = postgres(getDatabaseConfig().url, { prepare: false, max: 1 });

  try {
    await seedDatabase(drizzle(client, { schema }));
  } finally {
    await client.end();
  }
}

void run();
