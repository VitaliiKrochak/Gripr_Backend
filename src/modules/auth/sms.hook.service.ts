import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { normalizeUkrainianPhone } from '../../shared/phone/ukrainian.phone';
import { SMS_HOOK_CONFIG } from './auth.config';
import type { SmsHookConfig } from './auth.config';
import { OtpDeliveryService } from './otp.delivery.service';
import type { SmsHookDto } from './sms.hook.dto';
import { verifyWebhookSignature, WebhookHeaders } from './sms.hook.signature';

/** Supabase shows `error.message` to the caller of `signInWithOtp`. */
function hookError(status: HttpStatus, message: string): HttpException {
  return new HttpException({ error: { http_code: status, message } }, status);
}

@Injectable()
export class SmsHookService {
  constructor(
    @Inject(SMS_HOOK_CONFIG) private readonly config: SmsHookConfig,
    private readonly otpDelivery: OtpDeliveryService,
  ) {}

  verify(headers: WebhookHeaders, rawBody: Buffer | undefined): void {
    if (
      !rawBody ||
      !verifyWebhookSignature(this.config.secret, headers, rawBody)
    ) {
      throw hookError(HttpStatus.UNAUTHORIZED, 'Invalid hook signature');
    }
  }

  async send(payload: SmsHookDto): Promise<void> {
    const phone = normalizeUkrainianPhone(payload.user.phone);

    if (!phone) {
      throw hookError(
        HttpStatus.BAD_REQUEST,
        'Only Ukrainian phone numbers (+380) are supported',
      );
    }

    try {
      await this.otpDelivery.deliver(
        phone,
        payload.sms.otp,
        this.config.otpTtlSeconds,
      );
    } catch {
      throw hookError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'The verification code could not be delivered',
      );
    }
  }
}
