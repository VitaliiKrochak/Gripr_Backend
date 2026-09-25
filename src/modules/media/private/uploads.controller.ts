import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CloudinaryService } from '../../../integrations/cloudinary/cloudinary.service';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import { customerUploadFolder } from '../media.folders';
import { UploadSignatureDto } from '../upload.signature.dto';

@ApiTags('Customer uploads')
@ApiCookieAuth('access-token')
@Controller('customers/me/uploads')
export class PrivateUploadsController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Post('signature')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Sign a direct upload of reference images into the customer folder',
  })
  @ApiOkResponse({ type: UploadSignatureDto })
  sign(@CurrentUser() user: User): UploadSignatureDto {
    return this.cloudinary.createUploadSignature(
      customerUploadFolder(this.cloudinary, user.id),
    );
  }
}
