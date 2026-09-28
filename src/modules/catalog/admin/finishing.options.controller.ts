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
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import {
  CreateFinishingOptionDto,
  FinishingOptionDto,
  UpdateFinishingOptionDto,
} from '../dto/reference.dto';
import { ReferenceDataService } from '../reference.data.service';

@ApiTags('Admin: catalog reference data')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('finishing-options')
export class AdminFinishingOptionsController {
  constructor(private readonly referenceData: ReferenceDataService) {}

  @Get()
  @ApiOperation({
    summary: 'List engraving, coating, and processing operations',
  })
  @ApiOkResponse({ type: [FinishingOptionDto] })
  list(): Promise<FinishingOptionDto[]> {
    return this.referenceData.listFinishingOptions();
  }

  @Post()
  @ApiOperation({ summary: 'Create a finishing option' })
  @ApiCreatedResponse({ type: FinishingOptionDto })
  @ApiConflictResponse({ description: 'Code already exists' })
  create(@Body() dto: CreateFinishingOptionDto): Promise<FinishingOptionDto> {
    return this.referenceData.createFinishingOption(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a finishing option' })
  @ApiOkResponse({ type: FinishingOptionDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinishingOptionDto,
  ): Promise<FinishingOptionDto> {
    return this.referenceData.updateFinishingOption(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an unused finishing option' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'Used by product options' })
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.referenceData.deleteFinishingOption(id);
  }
}
