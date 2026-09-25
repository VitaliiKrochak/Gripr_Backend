import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import { AdminOrderDto } from '../../orders/dto/order.dto';
import { OrdersService } from '../../orders/orders.service';
import { ManualPaymentDto } from '../payment.dto';
import { PaymentsService } from '../payments.service';

@ApiTags('Admin: orders')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('orders/:orderId/payments')
export class AdminPaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Record a payment received outside LiqPay (cash, transfer)',
  })
  @ApiCreatedResponse({ type: AdminOrderDto })
  async recordManual(
    @CurrentUser() user: User,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: ManualPaymentDto,
  ): Promise<AdminOrderDto> {
    await this.paymentsService.recordManual(orderId, dto, user.id);
    return this.ordersService.get(orderId);
  }
}
