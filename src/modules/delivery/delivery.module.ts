import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { PrivateDeliveryController } from './private/delivery.controller';

@Module({
  controllers: [PrivateDeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
