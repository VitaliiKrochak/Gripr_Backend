import { Global, Module } from '@nestjs/common';
import { getNovaPoshtaConfig, NOVAPOSHTA_CONFIG } from './novaposhta.config';
import { NovaPoshtaService } from './novaposhta.service';

@Global()
@Module({
  providers: [
    {
      provide: NOVAPOSHTA_CONFIG,
      useFactory: getNovaPoshtaConfig,
    },
    NovaPoshtaService,
  ],
  exports: [NovaPoshtaService],
})
export class NovaPoshtaModule {}
