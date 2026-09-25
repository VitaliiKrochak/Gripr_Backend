import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import { ProductCardDto } from '../../catalog/dto/product.card.dto';
import { FavoritesService } from '../favorites.service';

@ApiTags('Favorites')
@ApiCookieAuth('access-token')
@Controller('customers/me/favorites')
export class PrivateFavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List favorite products, newest first' })
  @ApiOkResponse({ type: [ProductCardDto] })
  list(@CurrentUser() user: User): Promise<ProductCardDto[]> {
    return this.favoritesService.list(user);
  }

  @Put(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Add a product to favorites (idempotent)' })
  @ApiNoContentResponse()
  add(
    @CurrentUser() user: User,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    return this.favoritesService.add(user, productId);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a product from favorites' })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: User,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    return this.favoritesService.remove(user, productId);
  }
}
