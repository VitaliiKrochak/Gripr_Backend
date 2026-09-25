import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { CustomersModule } from '../customers/customers.module';
import { AdminOrdersController } from './admin/orders.controller';
import { OrdersService } from './orders.service';
import { PrivateOrdersController } from './private/orders.controller';

@Module({
  imports: [CartModule, CustomersModule],
  controllers: [PrivateOrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
