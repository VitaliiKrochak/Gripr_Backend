import { Global, Module } from '@nestjs/common';
import { NbuService } from './nbu.service';

@Global()
@Module({
  providers: [NbuService],
  exports: [NbuService],
})
export class NbuModule {}
