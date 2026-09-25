import { Global, Module } from '@nestjs/common';
import {
  getTelegramGatewayConfig,
  TELEGRAM_GATEWAY_CONFIG,
} from './telegram.config';
import { TelegramGatewayService } from './telegram.gateway.service';

@Global()
@Module({
  providers: [
    {
      provide: TELEGRAM_GATEWAY_CONFIG,
      useFactory: getTelegramGatewayConfig,
    },
    TelegramGatewayService,
  ],
  exports: [TelegramGatewayService],
})
export class TelegramModule {}
