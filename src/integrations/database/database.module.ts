import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import { DATABASE, DATABASE_CLIENT, Database } from './database.client';
import {
  DATABASE_CONFIG,
  DatabaseConfig,
  getDatabaseConfig,
} from './database.config';
import * as schema from './database.schema';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONFIG,
      useFactory: getDatabaseConfig,
    },
    {
      provide: DATABASE_CLIENT,
      inject: [DATABASE_CONFIG],
      // Supabase's transaction pooler does not support prepared statements.
      useFactory: (config: DatabaseConfig): Sql =>
        postgres(config.url, { prepare: false }),
    },
    {
      provide: DATABASE,
      inject: [DATABASE_CLIENT],
      useFactory: (client: Sql): Database => drizzle(client, { schema }),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_CLIENT) private readonly client: Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
