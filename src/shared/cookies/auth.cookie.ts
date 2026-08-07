import type { CookieOptions, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_PATH = '/api/auth/refresh';

interface AuthCookieTokens {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

function getAuthCookieDomain(): string | undefined {
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();

  if (domain && (domain.includes('://') || /[:/\s]/.test(domain))) {
    throw new Error(
      'AUTH_COOKIE_DOMAIN must be a domain without protocol, port, or path',
    );
  }

  return domain || undefined;
}

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}

export function setAuthCookies(
  response: Response,
  tokens: AuthCookieTokens,
): void {
  const domain = getAuthCookieDomain();
  const baseOptions = baseCookieOptions();

  if (tokens.accessToken) {
    response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...baseOptions,
      ...(domain ? { domain } : {}),
      expires: tokens.expiresAt ? new Date(tokens.expiresAt * 1000) : undefined,
      path: '/',
    });
  } else {
    response.clearCookie(ACCESS_TOKEN_COOKIE, {
      ...baseOptions,
      ...(domain ? { domain } : {}),
      path: '/',
    });
  }

  if (tokens.refreshToken) {
    response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...baseOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
      path: REFRESH_TOKEN_PATH,
    });
  } else {
    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...baseOptions,
      path: REFRESH_TOKEN_PATH,
    });
  }
}

export function clearAuthCookies(response: Response): void {
  const domain = getAuthCookieDomain();
  const baseOptions = baseCookieOptions();

  response.clearCookie(ACCESS_TOKEN_COOKIE, {
    ...baseOptions,
    ...(domain ? { domain } : {}),
    path: '/',
  });
  response.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...baseOptions,
    path: REFRESH_TOKEN_PATH,
  });
}
