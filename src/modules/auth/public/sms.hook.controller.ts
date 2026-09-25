import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../shared/decorators/public.decorator';
import { SmsHookDto } from '../sms.hook.dto';
import { SmsHookService } from '../sms.hook.service';

@Public()
@ApiTags('Auth')
@Controller('auth')
export class PublicSmsHookController {
  constructor(private readonly smsHookService: SmsHookService) {}

  @Post('sms-hook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supabase Auth "Send SMS" hook',
    description:
      'Called by Supabase only. Verifies the Standard Webhooks signature and delivers the one-time code via Telegram, falling back to Viber/SMS.',
  })
  @ApiOkResponse({ description: 'Code delivered' })
  async send(
    @Req() request: RawBodyRequest<Request>,
    @Headers('webhook-id') id: string | undefined,
    @Headers('webhook-timestamp') timestamp: string | undefined,
    @Headers('webhook-signature') signature: string | undefined,
    @Body() payload: SmsHookDto,
  ): Promise<Record<string, never>> {
    this.smsHookService.verify({ id, timestamp, signature }, request.rawBody);
    await this.smsHookService.send(payload);
    return {};
  }
}
