import { Injectable, Logger } from '@nestjs/common';
import { TelegramGatewayService } from '../../integrations/telegram/telegram.gateway.service';
import { TurboSmsService } from '../../integrations/turbosms/turbosms.service';
import { toE164 } from '../../shared/phone/ukrainian.phone';

export type OtpChannel = 'telegram' | 'turbosms';

@Injectable()
export class OtpDeliveryService {
  private readonly logger = new Logger(OtpDeliveryService.name);

  constructor(
    private readonly telegram: TelegramGatewayService,
    private readonly turboSms: TurboSmsService,
  ) {}

  /**
   * Delivers the code via Telegram and falls back to Viber/SMS.
   * `phone` must already be normalized to `380XXXXXXXXX`.
   */
  async deliver(
    phone: string,
    code: string,
    ttlSeconds: number,
  ): Promise<OtpChannel> {
    if (this.telegram.isConfigured()) {
      try {
        await this.telegram.sendVerificationCode(
          toE164(phone),
          code,
          ttlSeconds,
        );
        return 'telegram';
      } catch (error) {
        this.logger.warn(
          `Telegram delivery failed, falling back: ${(error as Error).message}`,
        );
      }
    }

    if (this.turboSms.isConfigured()) {
      await this.turboSms.sendHybrid(
        phone,
        `Ваш код для входу: ${code}`,
        ttlSeconds,
      );
      return 'turbosms';
    }

    throw new Error('No OTP delivery channel could deliver the code');
  }
}
