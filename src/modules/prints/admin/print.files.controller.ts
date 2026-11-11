import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import {
  AdminPrintFileDto,
  AdminPrintFileUploadDto,
  CreateProductPrintFileDto,
  MeasurePrintFileDto,
  PrintFileDownloadDto,
  PrintFileQueryDto,
} from '../dto/print.file.dto';
import { PrintFilesService } from '../print.files.service';

@ApiTags('Admin: Lab printing')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('print-files')
export class AdminPrintFilesController {
  constructor(private readonly printFiles: PrintFilesService) {}

  @Post()
  @ApiOperation({
    summary: 'Get a signed URL to upload the staff model of a Lab product',
  })
  @ApiCreatedResponse({ type: AdminPrintFileUploadDto })
  create(
    @Body() dto: CreateProductPrintFileDto,
  ): Promise<AdminPrintFileUploadDto> {
    return this.printFiles.createForProduct(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the model files of a Lab product' })
  @ApiOkResponse({ type: [AdminPrintFileDto] })
  list(@Query() query: PrintFileQueryDto): Promise<AdminPrintFileDto[]> {
    return this.printFiles.listForProduct(query.productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get any model file, including customer uploads' })
  @ApiOkResponse({ type: AdminPrintFileDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminPrintFileDto> {
    return this.printFiles.getForAdmin(id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a staff upload and start measuring it' })
  @ApiOkResponse({ type: AdminPrintFileDto })
  complete(@Param('id', ParseUUIDPipe) id: string): Promise<AdminPrintFileDto> {
    return this.printFiles.completeForAdmin(id);
  }

  @Patch(':id/measurements')
  @ApiOperation({
    summary: 'Enter the volume and size of a file measured by hand (STEP)',
  })
  @ApiOkResponse({ type: AdminPrintFileDto })
  measure(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MeasurePrintFileDto,
  ): Promise<AdminPrintFileDto> {
    return this.printFiles.measure(id, dto);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get a signed download URL, valid for 10 minutes' })
  @ApiOkResponse({ type: PrintFileDownloadDto })
  download(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrintFileDownloadDto> {
    return this.printFiles.download(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a model file no product takes its size from',
  })
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.printFiles.deleteForAdmin(id);
  }
}
