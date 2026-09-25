export interface TelegramGatewayConfig {
  /** Absent when Telegram delivery is disabled. */
  token?: string;
  baseUrl: string;
}

export const TELEGRAM_GATEWAY_CONFIG = Symbol('TELEGRAM_GATEWAY_CONFIG');

export function getTelegramGatewayConfig(): TelegramGatewayConfig {
  return {
    token: process.env.TELEGRAM_GATEWAY_TOKEN || undefined,
    baseUrl: 'https://gatewayapi.telegram.org',
  };
}
