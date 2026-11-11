import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import { ModelFileDownloadDto, PrintFileDto } from '../dto/print.file.dto';
import { PrintFilesService } from '../print.files.service';

@ApiTags('Lab model files')
@ApiCookieAuth('access-token')
@Controller('customers/me/orders/:orderId/files')
export class PrivateOrderFilesController {
  constructor(private readonly printFiles: PrintFilesService) {}

  @Get()
  @ApiOperation({ summary: 'List the model files a Lab order delivers' })
  @ApiOkResponse({ type: [PrintFileDto] })
  list(
    @CurrentUser() user: User,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PrintFileDto[]> {
    return this.printFiles.listForCustomerOrder(user, orderId);
  }

  @Get(':fileId')
  @ApiOperation({
    summary: 'Get a signed download URL of a delivered model file',
    description:
      'Valid for 10 minutes and returned with the license of the file. Available once the model is approved and the order is fully paid.',
  })
  @ApiOkResponse({ type: ModelFileDownloadDto })
  @ApiConflictResponse({
    description: 'The model is not approved or the order is not fully paid',
  })
  download(
    @CurrentUser() user: User,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<ModelFileDownloadDto> {
    return this.printFiles.downloadForCustomer(user, orderId, fileId);
  }
}
