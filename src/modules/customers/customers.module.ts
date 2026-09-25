import { Module } from '@nestjs/common';
import { AdminCustomersController } from './admin/customers.controller';
import { CustomersService } from './customers.service';
import { PrivateCustomersController } from './private/customers.controller';

@Module({
  // `customers/me` must be registered before `customers/:id`.
  controllers: [PrivateCustomersController, AdminCustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
