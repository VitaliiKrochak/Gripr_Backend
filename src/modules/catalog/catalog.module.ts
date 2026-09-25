import { Module } from '@nestjs/common';
import { AdminCollectionsController } from './admin/collections.controller';
import { AdminGemstonesController } from './admin/gemstones.controller';
import { AdminMetalsController } from './admin/metals.controller';
import { AdminProductsController } from './admin/products.controller';
import { AdminTagsController } from './admin/tags.controller';
import { CollectionsService } from './collections.service';
import { ProductCatalogService } from './product.catalog.service';
import { ProductImagesService } from './product.images.service';
import { ProductOptionsService } from './product.options.service';
import { ProductsService } from './products.service';
import { ReferenceDataService } from './reference.data.service';

@Module({
  controllers: [
    AdminMetalsController,
    AdminGemstonesController,
    AdminTagsController,
    AdminCollectionsController,
    AdminProductsController,
  ],
  providers: [
    ReferenceDataService,
    CollectionsService,
    ProductsService,
    ProductImagesService,
    ProductOptionsService,
    ProductCatalogService,
  ],
  exports: [
    ReferenceDataService,
    ProductCatalogService,
    ProductsService,
    ProductImagesService,
  ],
})
export class CatalogModule {}
