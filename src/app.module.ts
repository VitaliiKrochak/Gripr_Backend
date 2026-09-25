import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CloudinaryModule } from './integrations/cloudinary/cloudinary.module';
import { DatabaseModule } from './integrations/database/database.module';
import { LiqPayModule } from './integrations/liqpay/liqpay.module';
import { NovaPoshtaModule } from './integrations/novaposhta/novaposhta.module';
import { SupabaseModule } from './integrations/supabase/supabase.module';
import { TelegramModule } from './integrations/telegram/telegram.module';
import { TurboSmsModule } from './integrations/turbosms/turbosms.module';
import { AuthModule } from './modules/auth/auth.module';
import { CartModule } from './modules/cart/cart.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CustomRequestsModule } from './modules/custom.requests/custom.requests.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductionModule } from './modules/production/production.module';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { AuthGuard } from './shared/guards/auth.guard';

@Module({
  imports: [
    SupabaseModule,
    DatabaseModule,
    CloudinaryModule,
    TelegramModule,
    TurboSmsModule,
    LiqPayModule,
    NovaPoshtaModule,
    HealthModule,
    AuthModule,
    CustomersModule,
    MediaModule,
    CatalogModule,
    StorefrontModule,
    FavoritesModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    ProductionModule,
    CustomRequestsModule,
    DeliveryModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
