import { Module } from '@nestjs/common';
import { AdminMediaController } from './admin/media.controller';
import { PrivateUploadsController } from './private/uploads.controller';

@Module({
  controllers: [AdminMediaController, PrivateUploadsController],
})
export class MediaModule {}
