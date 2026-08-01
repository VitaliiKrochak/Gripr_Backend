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
  if (tokens.accessToken) {
    response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...baseCookieOptions(),
      expires: tokens.expiresAt ? new Date(tokens.expiresAt * 1000) : undefined,
      path: '/',
    });
  } else {
    response.clearCookie(ACCESS_TOKEN_COOKIE, {
      ...baseCookieOptions(),
      path: '/',
    });
  }

  if (tokens.refreshToken) {
    response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...baseCookieOptions(),
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
      path: REFRESH_TOKEN_PATH,
    });
  } else {
    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...baseCookieOptions(),
      path: REFRESH_TOKEN_PATH,
    });
  }
}

export function clearAuthCookies(response: Response): void {
  response.clearCookie(ACCESS_TOKEN_COOKIE, {
    ...baseCookieOptions(),
    path: '/',
  });
  response.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...baseCookieOptions(),
    path: REFRESH_TOKEN_PATH,
  });
}
