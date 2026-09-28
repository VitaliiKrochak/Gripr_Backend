import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import {
  QuoteDto,
  QuoteRequestDto,
  StorefrontProductDto,
} from '../storefront.dto';
import { StorefrontService } from '../storefront.service';

@ApiTags('Admin: products')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('products')
export class AdminProductPreviewController {
  constructor(private readonly storefront: StorefrontService) {}

  @Get(':id/preview')
  @ApiOperation({
    summary: 'Storefront view of a product in any status, including drafts',
  })
  @ApiOkResponse({ type: StorefrontProductDto })
  preview(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StorefrontProductDto> {
    return this.storefront.previewProduct(id);
  }

  @Post(':id/preview/quote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Price a configurator selection of any product' })
  @ApiOkResponse({ type: QuoteDto })
  quote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuoteRequestDto,
  ): Promise<QuoteDto> {
    return this.storefront.previewQuote(id, dto);
  }
}
