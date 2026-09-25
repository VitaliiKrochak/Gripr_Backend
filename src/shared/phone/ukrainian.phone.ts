const UKRAINIAN_PHONE = /^380\d{9}$/;

/**
 * Normalizes a Ukrainian mobile number to `380XXXXXXXXX`, or returns `null`
 * when the value is not a Ukrainian number.
 */
export function normalizeUkrainianPhone(value: string): string | null {
  let digits = value.replace(/\D/g, '');

  if (digits.length === 10 && digits.startsWith('0')) {
    digits = `38${digits}`;
  }

  return UKRAINIAN_PHONE.test(digits) ? digits : null;
}

export function toE164(phone: string): string {
  return `+${phone}`;
}
