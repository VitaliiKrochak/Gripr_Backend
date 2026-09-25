import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { CartService } from './cart.service';
import { PrivateCartController } from './private/cart.controller';

@Module({
  imports: [CatalogModule, CustomersModule],
  controllers: [PrivateCartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
