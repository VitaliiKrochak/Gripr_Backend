import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CloudinaryService } from '../../../integrations/cloudinary/cloudinary.service';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import {
  CreateAdminUploadSignatureDto,
  DestroyAssetDto,
  UploadSignatureDto,
} from '../upload.signature.dto';

@ApiTags('Admin: media')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('media')
export class AdminMediaController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Post('upload-signature')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign a direct Cloudinary upload' })
  @ApiOkResponse({ type: UploadSignatureDto })
  sign(@Body() dto: CreateAdminUploadSignatureDto): UploadSignatureDto {
    return this.cloudinary.createUploadSignature(
      this.cloudinary.folder(dto.folder),
    );
  }

  @Post('destroy')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an uploaded asset from Cloudinary' })
  @ApiNoContentResponse()
  async destroy(@Body() dto: DestroyAssetDto): Promise<void> {
    if (!dto.publicId.startsWith(`${this.cloudinary.folder()}/`)) {
      throw new BadRequestException('Only application assets can be deleted');
    }

    await this.cloudinary.destroy(dto.publicId);
  }
}
