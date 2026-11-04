import { Module } from '@nestjs/common';
import { AdminPricingController } from './admin/pricing.controller';
import { PricingService } from './pricing.service';
import { ProductPricingService } from './product.pricing.service';

@Module({
  controllers: [AdminPricingController],
  providers: [PricingService, ProductPricingService],
  exports: [ProductPricingService],
})
export class PricingModule {}
