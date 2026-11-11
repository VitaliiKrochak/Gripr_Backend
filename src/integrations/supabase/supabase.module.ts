import { Global, Module } from '@nestjs/common';
import { getSupabaseConfig, SUPABASE_CONFIG } from './supabase.config';
import { SupabaseService } from './supabase.service';
import { SupabaseStorageService } from './supabase.storage.service';

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CONFIG,
      useFactory: getSupabaseConfig,
    },
    SupabaseService,
    SupabaseStorageService,
  ],
  exports: [SupabaseService, SupabaseStorageService],
})
export class SupabaseModule {}
