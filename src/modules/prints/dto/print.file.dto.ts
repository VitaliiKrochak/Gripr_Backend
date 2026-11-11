import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PRINT_FILE_STATUSES } from '../../../integrations/database/database.schema';
import type { PrintFileStatus } from '../../../integrations/database/database.schema';
import { MODEL_FILE_LIMIT_BYTES } from '../../../integrations/supabase/supabase.storage.service';
import { MESH_WARNINGS } from '../mesh/mesh.analysis';
import type { MeshWarning } from '../mesh/mesh.analysis';
import { PrintSizeDto } from './product.print.dto';

export class CreatePrintFileDto {
  /** Original name; the extension decides the format (STL, OBJ, 3MF, ZIP, STEP). */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  /** At most 50 MB; send a ZIP or 3MF when the STL is larger. */
  @IsInt()
  @Min(1)
  @Max(MODEL_FILE_LIMIT_BYTES, { message: 'The file is larger than 50 MB' })
  sizeBytes: number;
}

export class CreateProductPrintFileDto extends CreatePrintFileDto {
  /** The Lab product the staff copy of the model belongs to. */
  @IsUUID()
  productId: string;
}

export class PrintFileQueryDto {
  @IsUUID()
  productId: string;
}

/** Staff measurements of a file that is not measured automatically. */
export class MeasurePrintFileDto {
  /** Model volume in ml, without supports. */
  @IsNumber()
  @Min(0.01)
  @Max(100000)
  volumeMl: number;

  @ValidateNested()
  @Type(() => PrintSizeDto)
  sizeMm: PrintSizeDto;
}

export class PrintFilePartDto {
  name: string;
  triangles: number;
  volumeMl: number;
  sizeMm: PrintSizeDto;
  isWatertight: boolean;
}

export class PrintFileDto {
  id: string;
  fileName: string;
  extension: string;
  sizeBytes: number;
  @ApiProperty({ enum: PRINT_FILE_STATUSES })
  status: PrintFileStatus;
  /** Why the file could not be measured. */
  error: string | null;
  /** Model volume in ml, without supports. */
  volumeMl: number | null;
  sizeMm: PrintSizeDto | null;
  triangles: number | null;
  isWatertight: boolean | null;
  /** The 3MF unit; `null` when the format has none (millimetres assumed). */
  units: string | null;
  parts: PrintFilePartDto[] | null;
  @ApiProperty({ enum: MESH_WARNINGS, isArray: true })
  warnings: MeshWarning[];
  uploadedAt: Date | null;
  analyzedAt: Date | null;
  createdAt: Date;
}

export class AdminPrintFileDto extends PrintFileDto {
  customerId: string | null;
  productId: string | null;
  /** A modeled file delivered to the customer of this order. */
  orderId: string | null;
}

export class PrintFileUploadDto {
  file: PrintFileDto;
  /** `PUT` the file here with its content type within two hours. */
  uploadUrl: string;
  /** For `supabase.storage.from('lab-models').uploadToSignedUrl`. */
  uploadToken: string;
  storagePath: string;
}

export class AdminPrintFileUploadDto extends PrintFileUploadDto {
  declare file: AdminPrintFileDto;
}

export class PrintFileDownloadDto {
  /** Signed download URL, valid for 10 minutes. */
  url: string;
  expiresAt: Date;
}

export class ModelFileDownloadDto extends PrintFileDownloadDto {
  /** Terms of use the customer accepts by downloading the file. */
  license: string;
}
