import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { AdminProductPreviewController } from './admin/product.preview.controller';
import { PublicStorefrontController } from './public/storefront.controller';
import { StorefrontService } from './storefront.service';

@Module({
  imports: [CatalogModule],
  controllers: [PublicStorefrontController, AdminProductPreviewController],
  providers: [StorefrontService],
  exports: [StorefrontService],
})
export class StorefrontModule {}
