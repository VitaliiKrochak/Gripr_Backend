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
import { CollectionsService } from '../collections.service';
import {
  AdminCollectionDto,
  CollectionDto,
  CollectionListQueryDto,
  CreateCollectionDto,
  UpdateCollectionDto,
} from '../dto/collection.dto';

@ApiTags('Admin: collections')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('collections')
export class AdminCollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @ApiOperation({ summary: 'List collections in every status' })
  @ApiOkResponse({ type: [AdminCollectionDto] })
  list(@Query() query: CollectionListQueryDto): Promise<AdminCollectionDto[]> {
    return this.collectionsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a collection' })
  @ApiOkResponse({ type: CollectionDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<CollectionDto> {
    return this.collectionsService.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a collection' })
  @ApiCreatedResponse({ type: CollectionDto })
  create(@Body() dto: CreateCollectionDto): Promise<CollectionDto> {
    return this.collectionsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a collection, including publish or archive via status',
  })
  @ApiOkResponse({ type: CollectionDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCollectionDto,
  ): Promise<CollectionDto> {
    return this.collectionsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a collection; its products stay without a collection',
  })
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.collectionsService.delete(id);
  }
}
