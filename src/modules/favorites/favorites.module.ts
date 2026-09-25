import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { FavoritesService } from './favorites.service';
import { PrivateFavoritesController } from './private/favorites.controller';

@Module({
  imports: [CatalogModule, CustomersModule],
  controllers: [PrivateFavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
