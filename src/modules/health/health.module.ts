import { Module } from '@nestjs/common';
import { PublicHealthController } from './public/health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [PublicHealthController],
  providers: [HealthService],
})
export class HealthModule {}
