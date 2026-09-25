import { Inject, Injectable } from '@nestjs/common';
import { TURBOSMS_CONFIG } from './turbosms.config';
import type { TurboSmsConfig } from './turbosms.config';

interface SendResponse {
  response_code: number;
  response_status: string;
  response_result?: Array<{
    phone: string;
    response_code: number;
    response_status: string;
    message_id: string | null;
  }> | null;
}

@Injectable()
export class TurboSmsService {
  constructor(
    @Inject(TURBOSMS_CONFIG) private readonly config: TurboSmsConfig,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.token);
  }

  /**
   * Sends a hybrid message: Viber first, SMS only if Viber rejects it within
   * `ttlSeconds` (so a stale code is never delivered by SMS later).
   */
  async sendHybrid(
    phone: string,
    text: string,
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.config.token) {
      throw new Error('TurboSMS is not configured');
    }

    const ttl = Math.min(Math.max(ttlSeconds, 30), 86400);
    const response = await fetch(`${this.config.baseUrl}/message/send.json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients: [phone],
        viber: { sender: this.config.sender, text, ttl },
        sms: { sender: this.config.sender, text, hybrid_ttl: ttl },
      }),
    });
    const payload = (await response.json()) as SendResponse;
    const result = payload.response_result?.[0];

    if (!result?.message_id) {
      throw new Error(
        `TurboSMS send failed: ${result?.response_status ?? payload.response_status}`,
      );
    }
  }
}
