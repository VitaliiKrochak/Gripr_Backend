import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminCustomRequestsController } from './admin/custom.requests.controller';
import { CustomRequestsService } from './custom.requests.service';
import { PrivateCustomRequestsController } from './private/custom.requests.controller';

@Module({
  imports: [CustomersModule, OrdersModule],
  controllers: [PrivateCustomRequestsController, AdminCustomRequestsController],
  providers: [CustomRequestsService],
  exports: [CustomRequestsService],
})
export class CustomRequestsModule {}
