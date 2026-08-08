import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseModule } from './integrations/supabase/supabase.module';
import { HealthModule } from './modules/health/health.module';
import { AuthGuard } from './shared/guards/auth.guard';

@Module({
  imports: [SupabaseModule, HealthModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
