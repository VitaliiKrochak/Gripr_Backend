export interface SmsHookConfig {
  /** Supabase "Send SMS" hook secret in the `v1,whsec_<base64>` format. */
  secret: string;
  otpTtlSeconds: number;
}

export const SMS_HOOK_CONFIG = Symbol('SMS_HOOK_CONFIG');

export function getSmsHookConfig(): SmsHookConfig {
  const secret = process.env.SUPABASE_SMS_HOOK_SECRET;

  if (!secret) {
    throw new Error('SUPABASE_SMS_HOOK_SECRET must be configured');
  }

  return { secret, otpTtlSeconds: 300 };
}
