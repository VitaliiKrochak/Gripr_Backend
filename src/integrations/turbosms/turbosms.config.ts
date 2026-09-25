export interface TurboSmsConfig {
  /** Absent when Viber/SMS delivery is disabled. */
  token?: string;
  /** Sender name activated in the TurboSMS account for Viber and SMS. */
  sender: string;
  baseUrl: string;
}

export const TURBOSMS_CONFIG = Symbol('TURBOSMS_CONFIG');

export function getTurboSmsConfig(): TurboSmsConfig {
  return {
    token: process.env.TURBOSMS_TOKEN || undefined,
    sender: process.env.TURBOSMS_SENDER || 'TurboSMS',
    baseUrl: 'https://api.turbosms.ua',
  };
}
