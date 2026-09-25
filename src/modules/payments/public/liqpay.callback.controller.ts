import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../shared/decorators/public.decorator';
import { LiqPayCallbackDto } from '../payment.dto';
import { PaymentsService } from '../payments.service';

@Public()
@ApiTags('Payments')
@Controller('payments/liqpay')
export class PublicLiqPayCallbackController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'LiqPay server-to-server payment status callback',
    description: 'Called by LiqPay only; the signature is verified.',
  })
  @ApiOkResponse({ description: 'Callback accepted' })
  async callback(@Body() dto: LiqPayCallbackDto): Promise<void> {
    await this.paymentsService.handleLiqPayCallback(dto.data, dto.signature);
  }
}
