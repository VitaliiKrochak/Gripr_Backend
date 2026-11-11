import { Global, Module } from '@nestjs/common';
import { getThingiverseConfig, THINGIVERSE_CONFIG } from './thingiverse.config';
import { ThingiverseService } from './thingiverse.service';

@Global()
@Module({
  providers: [
    {
      provide: THINGIVERSE_CONFIG,
      useFactory: getThingiverseConfig,
    },
    ThingiverseService,
  ],
  exports: [ThingiverseService],
})
export class ThingiverseModule {}
