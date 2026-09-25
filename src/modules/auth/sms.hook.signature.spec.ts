import { createHmac } from 'node:crypto';
import { verifyWebhookSignature } from './sms.hook.signature';

describe('verifyWebhookSignature', () => {
  const key = Buffer.from('super-secret-key');
  const secret = `v1,whsec_${key.toString('base64')}`;
  const body = Buffer.from('{"sms":{"otp":"123456"}}');
  const now = 1_750_000_000;

  function sign(id: string, timestamp: number): string {
    return createHmac('sha256', key)
      .update(`${id}.${timestamp}.${body.toString()}`)
      .digest('base64');
  }

  it('accepts a valid signature among several', () => {
    expect(
      verifyWebhookSignature(
        secret,
        {
          id: 'msg_1',
          timestamp: String(now),
          signature: `v1,invalid v1,${sign('msg_1', now)}`,
        },
        body,
        now,
      ),
    ).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(
      verifyWebhookSignature(
        secret,
        {
          id: 'msg_1',
          timestamp: String(now),
          signature: `v1,${sign('msg_1', now)}`,
        },
        Buffer.from('{"sms":{"otp":"000000"}}'),
        now,
      ),
    ).toBe(false);
  });

  it('rejects stale timestamps', () => {
    const sentAt = now - 600;

    expect(
      verifyWebhookSignature(
        secret,
        {
          id: 'msg_1',
          timestamp: String(sentAt),
          signature: `v1,${sign('msg_1', sentAt)}`,
        },
        body,
        now,
      ),
    ).toBe(false);
  });

  it('rejects missing headers', () => {
    expect(verifyWebhookSignature(secret, {}, body, now)).toBe(false);
  });
});
