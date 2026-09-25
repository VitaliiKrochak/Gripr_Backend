import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import { PaginationQueryDto } from '../../../shared/pagination/pagination.query.dto';
import { CheckoutDto } from '../dto/checkout.dto';
import { OrderDto, OrderSummaryPageDto } from '../dto/order.dto';
import { OrdersService } from '../orders.service';

@ApiTags('Orders')
@ApiCookieAuth('access-token')
@Controller('customers/me/orders')
export class PrivateOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({
    summary: 'Place an order from the cart (prices are computed server-side)',
  })
  @ApiCreatedResponse({ type: OrderDto })
  checkout(
    @CurrentUser() user: User,
    @Body() dto: CheckoutDto,
  ): Promise<OrderDto> {
    return this.ordersService.checkout(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my orders, newest first' })
  @ApiOkResponse({ type: OrderSummaryPageDto })
  list(
    @CurrentUser() user: User,
    @Query() query: PaginationQueryDto,
  ): Promise<OrderSummaryPageDto> {
    return this.ordersService.listForCustomer(user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Order details with production timeline and status history',
  })
  @ApiOkResponse({ type: OrderDto })
  get(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderDto> {
    return this.ordersService.getForCustomer(user, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order that is not paid yet' })
  @ApiOkResponse({ type: OrderDto })
  cancel(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderDto> {
    return this.ordersService.cancelByCustomer(user, id);
  }
}
