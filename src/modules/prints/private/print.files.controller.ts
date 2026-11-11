import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import {
  CreatePrintFileDto,
  PrintFileDto,
  PrintFileUploadDto,
} from '../dto/print.file.dto';
import { PrintFilesService } from '../print.files.service';

@ApiTags('Lab model files')
@ApiCookieAuth('access-token')
@Controller('customers/me/print-files')
export class PrivatePrintFilesController {
  constructor(private readonly printFiles: PrintFilesService) {}

  @Post()
  @ApiOperation({
    summary: 'Get a signed URL to upload a model (STL, OBJ, 3MF, ZIP, STEP)',
    description:
      'Checks the extension and size (at most 50 MB) and returns a signed upload URL valid for two hours. Answers 503 when uploads are not set up.',
  })
  @ApiCreatedResponse({ type: PrintFileUploadDto })
  create(
    @CurrentUser() user: User,
    @Body() dto: CreatePrintFileDto,
  ): Promise<PrintFileUploadDto> {
    return this.printFiles.createForCustomer(user, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm the upload and start measuring the model',
    description:
      'The file is measured in the background; poll the file until its status is no longer `analyzing`.',
  })
  @ApiOkResponse({ type: PrintFileDto })
  complete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrintFileDto> {
    return this.printFiles.completeForCustomer(user, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get the status and measurements of a model' })
  @ApiOkResponse({ type: PrintFileDto })
  get(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrintFileDto> {
    return this.printFiles.getForCustomer(user, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an uploaded model' })
  @ApiNoContentResponse()
  delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.printFiles.deleteForCustomer(user, id);
  }
}
