import { Global, Module } from '@nestjs/common';
import { getTurboSmsConfig, TURBOSMS_CONFIG } from './turbosms.config';
import { TurboSmsService } from './turbosms.service';

@Global()
@Module({
  providers: [
    {
      provide: TURBOSMS_CONFIG,
      useFactory: getTurboSmsConfig,
    },
    TurboSmsService,
  ],
  exports: [TurboSmsService],
})
export class TurboSmsModule {}
