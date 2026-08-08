import { ACCESS_TOKEN_COOKIE } from './auth.cookie';

describe('auth cookies', () => {
  it('uses the access cookie name forwarded by the Next.js BFF', () => {
    expect(ACCESS_TOKEN_COOKIE).toBe('access_token');
  });
});
