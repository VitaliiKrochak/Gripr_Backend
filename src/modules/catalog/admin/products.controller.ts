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
  Put,
  Query,
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
  AdminProductDto,
  AdminProductListQueryDto,
  AdminProductPageDto,
  CreateOptionGroupDto,
  CreateOptionValueDto,
  CreateProductDto,
  CreateProductImageDto,
  ProductImageDto,
  ReorderDto,
  UpdateOptionGroupDto,
  UpdateOptionValueDto,
  UpdateProductDto,
  UpdateProductImageDto,
} from '../dto/product.dto';
import { ProductImagesService } from '../product.images.service';
import { ProductOptionsService } from '../product.options.service';
import { ProductsService } from '../products.service';

@ApiTags('Admin: products')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('products')
export class AdminProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly imagesService: ProductImagesService,
    private readonly optionsService: ProductOptionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List products in every status' })
  @ApiOkResponse({ type: AdminProductPageDto })
  list(@Query() query: AdminProductListQueryDto): Promise<AdminProductPageDto> {
    return this.productsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product with images, tags, and options' })
  @ApiOkResponse({ type: AdminProductDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminProductDto> {
    return this.productsService.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a product' })
  @ApiCreatedResponse({ type: AdminProductDto })
  create(@Body() dto: CreateProductDto): Promise<AdminProductDto> {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update a product; `status` publishes or archives it and `tagIds` replaces its tags',
  })
  @ApiOkResponse({ type: AdminProductDto })
  @ApiConflictResponse({
    description:
      'Slug already exists, or a product made from an open design is published without a price',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<AdminProductDto> {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a product; past orders keep their snapshot',
  })
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.productsService.delete(id);
  }

  @Post(':id/images')
  @ApiOperation({ summary: 'Attach an uploaded Cloudinary image' })
  @ApiCreatedResponse({ type: ProductImageDto })
  addImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProductImageDto,
  ): Promise<ProductImageDto> {
    return this.imagesService.add(id, dto);
  }

  @Put(':id/images/order')
  @ApiOperation({ summary: 'Reorder all product images' })
  @ApiOkResponse({ type: [ProductImageDto] })
  reorderImages(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderDto,
  ): Promise<ProductImageDto[]> {
    return this.imagesService.reorder(id, dto.ids);
  }

  @Patch(':id/images/:imageId')
  @ApiOperation({ summary: 'Update image alt text, option link, or order' })
  @ApiOkResponse({ type: ProductImageDto })
  updateImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateProductImageDto,
  ): Promise<ProductImageDto> {
    return this.imagesService.update(id, imageId, dto);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Detach an image from the product' })
  @ApiNoContentResponse()
  deleteImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    return this.imagesService.delete(id, imageId);
  }

  @Post(':id/option-groups')
  @ApiOperation({ summary: 'Add a configurator option group' })
  @ApiCreatedResponse({ type: AdminProductDto })
  async createGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOptionGroupDto,
  ): Promise<AdminProductDto> {
    await this.optionsService.createGroup(id, dto);
    return this.productsService.get(id);
  }

  @Patch(':id/option-groups/:groupId')
  @ApiOperation({ summary: 'Update an option group' })
  @ApiOkResponse({ type: AdminProductDto })
  async updateGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateOptionGroupDto,
  ): Promise<AdminProductDto> {
    await this.optionsService.updateGroup(id, groupId, dto);
    return this.productsService.get(id);
  }

  @Delete(':id/option-groups/:groupId')
  @ApiOperation({ summary: 'Delete an option group with its values' })
  @ApiOkResponse({ type: AdminProductDto })
  async deleteGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<AdminProductDto> {
    await this.optionsService.deleteGroup(id, groupId);
    return this.productsService.get(id);
  }

  @Post(':id/option-groups/:groupId/values')
  @ApiOperation({ summary: 'Add an option value with its price delta' })
  @ApiCreatedResponse({ type: AdminProductDto })
  async createValue(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateOptionValueDto,
  ): Promise<AdminProductDto> {
    await this.optionsService.createValue(id, groupId, dto);
    return this.productsService.get(id);
  }

  @Patch(':id/option-groups/:groupId/values/:valueId')
  @ApiOperation({ summary: 'Update an option value' })
  @ApiOkResponse({ type: AdminProductDto })
  async updateValue(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('valueId', ParseUUIDPipe) valueId: string,
    @Body() dto: UpdateOptionValueDto,
  ): Promise<AdminProductDto> {
    await this.optionsService.updateValue(id, groupId, valueId, dto);
    return this.productsService.get(id);
  }

  @Delete(':id/option-groups/:groupId/values/:valueId')
  @ApiOperation({ summary: 'Delete an option value' })
  @ApiOkResponse({ type: AdminProductDto })
  async deleteValue(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('valueId', ParseUUIDPipe) valueId: string,
  ): Promise<AdminProductDto> {
    await this.optionsService.deleteValue(id, groupId, valueId);
    return this.productsService.get(id);
  }
}
