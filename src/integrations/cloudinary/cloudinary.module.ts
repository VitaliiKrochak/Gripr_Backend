import { Global, Module } from '@nestjs/common';
import { CLOUDINARY_CONFIG, getCloudinaryConfig } from './cloudinary.config';
import { CloudinaryService } from './cloudinary.service';

@Global()
@Module({
  providers: [
    {
      provide: CLOUDINARY_CONFIG,
      useFactory: getCloudinaryConfig,
    },
    CloudinaryService,
  ],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
