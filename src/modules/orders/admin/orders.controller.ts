import {
  Body,
  Controller,
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
  ApiOkResponse,
  ApiConflictResponse,
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
import {
  AdminOrderDto,
  AdminOrderPageDto,
  ModelRevisionDto,
} from '../dto/order.dto';
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

  @Post(':id/model/revisions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Classify the model changes a Gripr Lab customer requested; a paid revision returns the order to awaiting model payment',
  })
  @ApiOkResponse({ type: AdminOrderDto })
  @ApiConflictResponse({
    description: 'The order has no requested model changes to classify',
  })
  recordModelRevision(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModelRevisionDto,
  ): Promise<AdminOrderDto> {
    return this.ordersService.recordModelRevision(id, dto.kind, user.id);
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
