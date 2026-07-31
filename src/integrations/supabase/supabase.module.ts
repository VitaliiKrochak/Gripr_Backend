import { Global, Module } from '@nestjs/common';
import { getSupabaseConfig, SUPABASE_CONFIG } from './supabase.config';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CONFIG,
      useFactory: getSupabaseConfig,
    },
    SupabaseService,
  ],
  exports: [SupabaseService],
})
export class SupabaseModule {}
