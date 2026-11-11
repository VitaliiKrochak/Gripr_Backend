import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminOrderFilesController } from './admin/order.files.controller';
import { AdminPrintFilesController } from './admin/print.files.controller';
import { AdminPrintPricingController } from './admin/print.pricing.controller';
import { AdminPrintRequestsController } from './admin/print.requests.controller';
import { AdminPrintSettingsController } from './admin/print.settings.controller';
import { MeshAnalyzer } from './mesh/mesh.analyzer';
import { PrintFilesService } from './print.files.service';
import { PrintPricingService } from './print.pricing.service';
import { PrintRequestsService } from './print.requests.service';
import { AdminPrintersController } from './admin/printers.controller';
import { AdminResinsController } from './admin/resins.controller';
import { PrintSettingsService } from './print.settings.service';
import { PrintersService } from './printers.service';
import { PrivateOrderFilesController } from './private/order.files.controller';
import { PrivatePrintFilesController } from './private/print.files.controller';
import { PrivatePrintRequestsController } from './private/print.requests.controller';
import { PublicPrintOptionsController } from './public/storefront.print.options.controller';
import { PublicResinsController } from './public/storefront.resins.controller';
import { ResinsService } from './resins.service';

@Module({
  imports: [PricingModule, CustomersModule],
  controllers: [
    AdminResinsController,
    AdminPrintersController,
    AdminPrintSettingsController,
    AdminPrintPricingController,
    AdminPrintFilesController,
    AdminPrintRequestsController,
    AdminOrderFilesController,
    PrivatePrintFilesController,
    PrivateOrderFilesController,
    PrivatePrintRequestsController,
    PublicResinsController,
    PublicPrintOptionsController,
  ],
  providers: [
    ResinsService,
    PrintersService,
    PrintSettingsService,
    PrintPricingService,
    PrintFilesService,
    PrintRequestsService,
    MeshAnalyzer,
  ],
})
export class PrintsModule {}
