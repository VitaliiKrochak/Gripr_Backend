import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import {
  AdminPrintFileDto,
  AdminPrintFileUploadDto,
  CreatePrintFileDto,
} from '../dto/print.file.dto';
import { PrintFilesService } from '../print.files.service';

@ApiTags('Admin: Lab printing')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('orders/:orderId/files')
export class AdminOrderFilesController {
  constructor(private readonly printFiles: PrintFilesService) {}

  @Post()
  @ApiOperation({
    summary: 'Get a signed URL to upload the model file a Lab order delivers',
    description:
      'Only for Gripr Lab modeling orders whose deliverable includes the file. Confirm the upload with `POST /print-files/:id/complete`.',
  })
  @ApiCreatedResponse({ type: AdminPrintFileUploadDto })
  create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreatePrintFileDto,
  ): Promise<AdminPrintFileUploadDto> {
    return this.printFiles.createForOrder(orderId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the model files delivered with an order' })
  @ApiOkResponse({ type: [AdminPrintFileDto] })
  list(
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<AdminPrintFileDto[]> {
    return this.printFiles.listForOrder(orderId);
  }
}
