import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../../integrations/supabase/supabase.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const getAllAndOverride = jest.fn();
  const getUser = jest.fn();
  const reflector = { getAllAndOverride } as unknown as Reflector;
  const supabaseService = { getUser } as unknown as SupabaseService;
  const guard = new AuthGuard(reflector, supabaseService);

  function createContext(request: Record<string, unknown>): ExecutionContext {
    return {
      getClass: jest.fn(),
      getHandler: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    getAllAndOverride.mockReturnValue(false);
  });

  it('allows explicitly public operations without a token', async () => {
    getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('rejects protected operations without the BFF access cookie', async () => {
    await expect(
      guard.canActivate(createContext({ cookies: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('verifies the access token and attaches its trusted user', async () => {
    const user = { id: 'user-id', app_metadata: { role: 'admin' } };
    const request = { cookies: { access_token: 'access-token' } };
    getUser.mockResolvedValue(user);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(getUser).toHaveBeenCalledWith('access-token');
    expect(request).toMatchObject({ accessToken: 'access-token', user });
  });

  it('rejects an invalid or expired access token', async () => {
    getUser.mockRejectedValue(new Error('invalid token'));

    await expect(
      guard.canActivate(
        createContext({ cookies: { access_token: 'expired-token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
