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
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import { CreateTagDto, TagDto, UpdateTagDto } from '../dto/reference.dto';
import { ReferenceDataService } from '../reference.data.service';

@ApiTags('Admin: catalog reference data')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('tags')
export class AdminTagsController {
  constructor(private readonly referenceData: ReferenceDataService) {}

  @Get()
  @ApiOperation({ summary: 'List all tags' })
  @ApiOkResponse({ type: [TagDto] })
  list(): Promise<TagDto[]> {
    return this.referenceData.listTags();
  }

  @Post()
  @ApiOperation({ summary: 'Create a tag' })
  @ApiCreatedResponse({ type: TagDto })
  create(@Body() dto: CreateTagDto): Promise<TagDto> {
    return this.referenceData.createTag(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tag' })
  @ApiOkResponse({ type: TagDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
  ): Promise<TagDto> {
    return this.referenceData.updateTag(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tag and detach it from products' })
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.referenceData.deleteTag(id);
  }
}
