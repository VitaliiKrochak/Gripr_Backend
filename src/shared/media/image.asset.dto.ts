import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class ImageAssetDto {
  /** Cloudinary public id returned by the upload. */
  @IsString()
  @MaxLength(255)
  publicId: string;

  /** Cloudinary `secure_url` returned by the upload. */
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(1000)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt?: string;
}
