import { Global, Module } from '@nestjs/common';
import { getLiqPayConfig, LIQPAY_CONFIG } from './liqpay.config';
import { LiqPayService } from './liqpay.service';

@Global()
@Module({
  providers: [
    {
      provide: LIQPAY_CONFIG,
      useFactory: getLiqPayConfig,
    },
    LiqPayService,
  ],
  exports: [LiqPayService],
})
export class LiqPayModule {}
