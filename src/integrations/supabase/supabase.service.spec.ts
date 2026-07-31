import type { SupabaseConfig } from './supabase.config';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  const config: SupabaseConfig = {
    url: 'https://example.supabase.co',
    publishableKey: 'test-publishable-key',
    secretKey: 'test-secret-key',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('isolates concurrent session refreshes', async () => {
    const requestedRefreshTokens: string[] = [];

    jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      if (typeof init?.body !== 'string') {
        throw new Error('Expected a JSON request body');
      }

      const body = JSON.parse(init.body) as {
        refresh_token: string;
      };
      const suffix = body.refresh_token.endsWith('A') ? 'A' : 'B';
      requestedRefreshTokens.push(body.refresh_token);

      await new Promise((resolve) => setImmediate(resolve));

      return new Response(
        JSON.stringify({
          access_token: `access-${suffix}`,
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: `rotated-${suffix}`,
          user: {
            id: `user-${suffix}`,
            aud: 'authenticated',
            role: 'authenticated',
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    });

    const service = new SupabaseService(config);
    const [first, second] = await Promise.all([
      service.refreshSession('refresh-token-A'),
      service.refreshSession('refresh-token-B'),
    ]);

    expect(requestedRefreshTokens).toEqual([
      'refresh-token-A',
      'refresh-token-B',
    ]);
    expect(first.user?.id).toBe('user-A');
    expect(first.session?.access_token).toBe('access-A');
    expect(second.user?.id).toBe('user-B');
    expect(second.session?.access_token).toBe('access-B');
  });

  it('signs out only the session identified by the access token', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const service = new SupabaseService(config);

    await service.signOut('access-token');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/v1/logout?scope=local'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
