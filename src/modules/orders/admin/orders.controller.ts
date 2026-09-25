import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import {
  AdminOrderListQueryDto,
  ChangeOrderStatusDto,
  UpdateOrderDeliveryDto,
  UpdateOrderDto,
} from '../dto/order.admin.dto';
import { AdminOrderDto, AdminOrderPageDto } from '../dto/order.dto';
import { OrdersService } from '../orders.service';

@ApiTags('Admin: orders')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders' })
  @ApiOkResponse({ type: AdminOrderPageDto })
  list(@Query() query: AdminOrderListQueryDto): Promise<AdminOrderPageDto> {
    return this.ordersService.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Order with all production steps, payments, and history',
  })
  @ApiOkResponse({ type: AdminOrderDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminOrderDto> {
    return this.ordersService.get(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Move the order to another status (see allowedTransitions)',
  })
  @ApiOkResponse({ type: AdminOrderDto })
  changeStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeOrderStatusDto,
  ): Promise<AdminOrderDto> {
    return this.ordersService.changeStatus(id, dto.status, {
      note: dto.note,
      changedBy: user.id,
    });
  }

  @Patch(':id/delivery')
  @ApiOperation({
    summary: 'Set the Nova Poshta tracking number or correct the address',
  })
  @ApiOkResponse({ type: AdminOrderDto })
  updateDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDeliveryDto,
  ): Promise<AdminOrderDto> {
    return this.ordersService.updateDelivery(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update the internal admin note' })
  @ApiOkResponse({ type: AdminOrderDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ): Promise<AdminOrderDto> {
    return this.ordersService.update(id, dto);
  }
}
