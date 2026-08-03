import type { CookieOptions, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from './auth.cookie';

describe('auth cookies', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCookieDomain = process.env.AUTH_COOKIE_DOMAIN;

  function createResponse(): {
    response: Response;
    cookie: jest.MockedFunction<
      (name: string, value: string, options: CookieOptions) => Response
    >;
    clearCookie: jest.MockedFunction<
      (name: string, options: CookieOptions) => Response
    >;
  } {
    const cookie =
      jest.fn<
        (name: string, value: string, options: CookieOptions) => Response
      >();
    const clearCookie =
      jest.fn<(name: string, options: CookieOptions) => Response>();

    return {
      response: { cookie, clearCookie } as unknown as Response,
      cookie,
      clearCookie,
    };
  }

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalCookieDomain === undefined) {
      delete process.env.AUTH_COOKIE_DOMAIN;
    } else {
      process.env.AUTH_COOKIE_DOMAIN = originalCookieDomain;
    }
  });

  it('sets both cookies with the configured domain and their distinct paths', () => {
    process.env.AUTH_COOKIE_DOMAIN = 'example.com';
    const { response, cookie } = createResponse();

    setAuthCookies(response, {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 1_800_000_000,
    });

    expect(cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'access-token',
      expect.objectContaining({
        domain: 'example.com',
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
      }),
    );
    expect(cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh-token',
      expect.objectContaining({
        domain: 'example.com',
        httpOnly: true,
        path: '/api/auth/refresh',
        sameSite: 'lax',
      }),
    );
  });

  it('clears both cookies with the same configured domain and paths', () => {
    process.env.AUTH_COOKIE_DOMAIN = 'example.com';
    const { response, clearCookie } = createResponse();

    clearAuthCookies(response);

    expect(clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.objectContaining({ domain: 'example.com', path: '/' }),
    );
    expect(clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({
        domain: 'example.com',
        path: '/api/auth/refresh',
      }),
    );
  });

  it.each([undefined, ''])(
    'omits Domain for a missing or empty configuration (%s)',
    (domain) => {
      if (domain === undefined) {
        delete process.env.AUTH_COOKIE_DOMAIN;
      } else {
        process.env.AUTH_COOKIE_DOMAIN = domain;
      }
      const { response, cookie } = createResponse();

      setAuthCookies(response, {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: null,
      });

      expect(cookie.mock.calls[0]?.[2]).not.toHaveProperty('domain');
      expect(cookie.mock.calls[1]?.[2]).not.toHaveProperty('domain');
    },
  );

  it.each(['https://example.com', 'example.com:443', 'example.com/auth'])(
    'rejects an invalid cookie domain: %s',
    (domain) => {
      process.env.AUTH_COOKIE_DOMAIN = domain;
      const { response } = createResponse();

      expect(() => clearAuthCookies(response)).toThrow(
        'AUTH_COOKIE_DOMAIN must be a domain without protocol, port, or path',
      );
    },
  );
});
