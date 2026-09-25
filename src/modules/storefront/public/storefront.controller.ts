import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../shared/decorators/public.decorator';
import {
  ProductCardDto,
  ProductCardPageDto,
} from '../../catalog/dto/product.card.dto';
import {
  QuoteDto,
  QuoteRequestDto,
  StorefrontCollectionDetailsDto,
  StorefrontCollectionDto,
  StorefrontFiltersDto,
  StorefrontHomeDto,
  StorefrontProductDto,
  StorefrontProductQueryDto,
} from '../storefront.dto';
import { StorefrontService } from '../storefront.service';

@Public()
@ApiTags('Storefront')
@Controller('storefront')
export class PublicStorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Get('home')
  @ApiOperation({
    summary: 'Home page: featured collections, hot, new, and featured pieces',
  })
  @ApiOkResponse({ type: StorefrontHomeDto })
  home(): Promise<StorefrontHomeDto> {
    return this.storefront.home();
  }

  @Get('filters')
  @ApiOperation({ summary: 'Values available for catalog filters' })
  @ApiOkResponse({ type: StorefrontFiltersDto })
  filters(): Promise<StorefrontFiltersDto> {
    return this.storefront.filters();
  }

  @Get('products')
  @ApiOperation({ summary: 'Search and filter published products' })
  @ApiOkResponse({ type: ProductCardPageDto })
  listProducts(
    @Query() query: StorefrontProductQueryDto,
  ): Promise<ProductCardPageDto> {
    return this.storefront.listProducts(query);
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Product page with configurator options' })
  @ApiOkResponse({ type: StorefrontProductDto })
  getProduct(@Param('slug') slug: string): Promise<StorefrontProductDto> {
    return this.storefront.getProduct(slug);
  }

  @Post('products/:slug/quote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Price and production time for a configurator selection',
  })
  @ApiOkResponse({ type: QuoteDto })
  quote(
    @Param('slug') slug: string,
    @Body() dto: QuoteRequestDto,
  ): Promise<QuoteDto> {
    return this.storefront.quote(slug, dto);
  }

  @Get('products/:slug/recommendations')
  @ApiOperation({ summary: 'Related pieces for a product page' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: [ProductCardDto] })
  recommendations(
    @Param('slug') slug: string,
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ): Promise<ProductCardDto[]> {
    return this.storefront.recommendations(
      slug,
      Math.min(Math.max(limit, 1), 24),
    );
  }

  @Get('collections')
  @ApiOperation({ summary: 'Published collections' })
  @ApiOkResponse({ type: [StorefrontCollectionDto] })
  listCollections(): Promise<StorefrontCollectionDto[]> {
    return this.storefront.listCollections();
  }

  @Get('collections/:slug')
  @ApiOperation({ summary: 'Collection page with its pieces and set price' })
  @ApiOkResponse({ type: StorefrontCollectionDetailsDto })
  getCollection(
    @Param('slug') slug: string,
  ): Promise<StorefrontCollectionDetailsDto> {
    return this.storefront.getCollection(slug);
  }
}
