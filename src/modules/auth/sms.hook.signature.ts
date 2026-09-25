import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 5 * 60;

export interface WebhookHeaders {
  id?: string;
  timestamp?: string;
  signature?: string;
}

/**
 * Verifies a Standard Webhooks signature as sent by Supabase Auth hooks.
 * Returns `false` for missing headers, stale timestamps, or bad signatures.
 */
export function verifyWebhookSignature(
  secret: string,
  headers: WebhookHeaders,
  rawBody: Buffer,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;

  if (!id || !timestamp || !signature) {
    return false;
  }

  const sentAt = Number(timestamp);

  if (
    !Number.isInteger(sentAt) ||
    Math.abs(nowSeconds - sentAt) > TOLERANCE_SECONDS
  ) {
    return false;
  }

  const key = Buffer.from(
    secret.replace(/^v1,/, '').replace(/^whsec_/, ''),
    'base64',
  );
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.`)
    .update(rawBody)
    .digest();

  return signature.split(' ').some((entry) => {
    const [version, value] = entry.split(',');
    const candidate = Buffer.from(value ?? '', 'base64');

    return (
      version === 'v1' &&
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    );
  });
}
