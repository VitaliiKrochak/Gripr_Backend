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
import { AddCartItemDto, CartDto, UpdateCartItemDto } from '../cart.dto';
import { CartService } from '../cart.service';

@ApiTags('Cart')
@ApiCookieAuth('access-token')
@Controller('customers/me/cart')
export class PrivateCartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get the priced cart' })
  @ApiOkResponse({ type: CartDto })
  get(@CurrentUser() user: User): Promise<CartDto> {
    return this.cartService.get(user);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Add a configured product; identical configurations increase the quantity',
  })
  @ApiOkResponse({ type: CartDto })
  add(
    @CurrentUser() user: User,
    @Body() dto: AddCartItemDto,
  ): Promise<CartDto> {
    return this.cartService.add(user, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Change quantity or configuration of a line' })
  @ApiOkResponse({ type: CartDto })
  update(
    @CurrentUser() user: User,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartDto> {
    return this.cartService.update(user, itemId, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove a line' })
  @ApiOkResponse({ type: CartDto })
  remove(
    @CurrentUser() user: User,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<CartDto> {
    return this.cartService.remove(user, itemId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Empty the cart' })
  @ApiNoContentResponse()
  clear(@CurrentUser() user: User): Promise<void> {
    return this.cartService.clear(user.id);
  }

  @Post('sets/:collectionSlug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add every piece of a set collection with default options',
  })
  @ApiOkResponse({ type: CartDto })
  addSet(
    @CurrentUser() user: User,
    @Param('collectionSlug') collectionSlug: string,
  ): Promise<CartDto> {
    return this.cartService.addSet(user, collectionSlug);
  }
}
