import { Inject, Injectable } from '@nestjs/common';
import { TELEGRAM_GATEWAY_CONFIG } from './telegram.config';
import type { TelegramGatewayConfig } from './telegram.config';

interface GatewayResponse<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

interface RequestStatus {
  request_id: string;
}

@Injectable()
export class TelegramGatewayService {
  constructor(
    @Inject(TELEGRAM_GATEWAY_CONFIG)
    private readonly config: TelegramGatewayConfig,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.token);
  }

  /**
   * Sends `code` to the Telegram account registered with `phoneE164`.
   * Throws when the number has no Telegram account or the request fails.
   */
  async sendVerificationCode(
    phoneE164: string,
    code: string,
    ttlSeconds: number,
  ): Promise<void> {
    const ability = await this.call<RequestStatus>('checkSendAbility', {
      phone_number: phoneE164,
    });

    await this.call<RequestStatus>('sendVerificationMessage', {
      phone_number: phoneE164,
      request_id: ability.request_id,
      code,
      ttl: Math.min(Math.max(ttlSeconds, 30), 3600),
    });
  }

  private async call<T>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    if (!this.config.token) {
      throw new Error('Telegram Gateway is not configured');
    }

    const response = await fetch(`${this.config.baseUrl}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as GatewayResponse<T>;

    if (!payload.ok || !payload.result) {
      throw new Error(`Telegram Gateway ${method} failed: ${payload.error}`);
    }

    return payload.result;
  }
}
