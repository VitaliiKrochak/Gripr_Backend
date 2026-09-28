import { Global, Module } from '@nestjs/common';
import { getSketchfabConfig, SKETCHFAB_CONFIG } from './sketchfab.config';
import { SketchfabService } from './sketchfab.service';

@Global()
@Module({
  providers: [
    {
      provide: SKETCHFAB_CONFIG,
      useFactory: getSketchfabConfig,
    },
    SketchfabService,
  ],
  exports: [SketchfabService, SKETCHFAB_CONFIG],
})
export class SketchfabModule {}
