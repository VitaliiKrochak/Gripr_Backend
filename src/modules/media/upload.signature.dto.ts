import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';

export const ADMIN_UPLOAD_FOLDERS = [
  'products',
  'collections',
  'production',
  'messages',
] as const;
export type AdminUploadFolder = (typeof ADMIN_UPLOAD_FOLDERS)[number];

export class CreateAdminUploadSignatureDto {
  @ApiProperty({ enum: ADMIN_UPLOAD_FOLDERS })
  @IsIn(ADMIN_UPLOAD_FOLDERS)
  folder: AdminUploadFolder;
}

export class DestroyAssetDto {
  @IsString()
  @MaxLength(255)
  publicId: string;
}

/**
 * Fields for a signed direct upload: POST multipart form data with `file`,
 * `api_key`, `timestamp`, `folder`, and `signature` to `uploadUrl`.
 */
export class UploadSignatureDto {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
}
