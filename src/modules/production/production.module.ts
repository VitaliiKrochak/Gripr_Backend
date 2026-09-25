import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AdminProductionStagesController } from './admin/production.stages.controller';
import { AdminProductionStepsController } from './admin/production.steps.controller';
import { ProductionStagesService } from './production.stages.service';
import { ProductionStepsService } from './production.steps.service';

@Module({
  imports: [OrdersModule],
  controllers: [
    AdminProductionStagesController,
    AdminProductionStepsController,
  ],
  providers: [ProductionStagesService, ProductionStepsService],
})
export class ProductionModule {}
