import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import { AdminOrderDto } from '../../orders/dto/order.dto';
import { OrdersService } from '../../orders/orders.service';
import {
  CreateProductionStepsDto,
  ReorderProductionStepsDto,
  UpdateProductionStepDto,
} from '../dto/production.step.dto';
import { ProductionStepsService } from '../production.steps.service';

@ApiTags('Admin: production')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller()
export class AdminProductionStepsController {
  constructor(
    private readonly steps: ProductionStepsService,
    private readonly orders: OrdersService,
  ) {}

  @Post('orders/:orderId/items/:itemId/production-steps')
  @ApiOperation({
    summary: 'Apply a production template (or chosen stages) to an order item',
  })
  @ApiCreatedResponse({ type: AdminOrderDto })
  async create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateProductionStepsDto,
  ): Promise<AdminOrderDto> {
    await this.steps.create(orderId, itemId, dto);
    return this.orders.get(orderId);
  }

  @Put('orders/:orderId/items/:itemId/production-steps/order')
  @ApiOperation({ summary: 'Reorder all production steps of an order item' })
  @ApiOkResponse({ type: AdminOrderDto })
  async reorder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ReorderProductionStepsDto,
  ): Promise<AdminOrderDto> {
    await this.steps.reorder(orderId, itemId, dto.ids);
    return this.orders.get(orderId);
  }

  @Patch('production-steps/:id')
  @ApiOperation({
    summary: 'Move a production step, add a note or photos, or hide it',
  })
  @ApiOkResponse({ type: AdminOrderDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductionStepDto,
  ): Promise<AdminOrderDto> {
    return this.orders.get(await this.steps.update(id, dto));
  }

  @Delete('production-steps/:id')
  @ApiOperation({ summary: 'Remove a production step from an order item' })
  @ApiOkResponse({ type: AdminOrderDto })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<AdminOrderDto> {
    return this.orders.get(await this.steps.delete(id));
  }
}
