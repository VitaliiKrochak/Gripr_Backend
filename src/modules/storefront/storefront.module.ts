import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { PublicStorefrontController } from './public/storefront.controller';
import { StorefrontService } from './storefront.service';

@Module({
  imports: [CatalogModule],
  controllers: [PublicStorefrontController],
  providers: [StorefrontService],
})
export class StorefrontModule {}
