import type { SupabaseConfig } from './supabase.config';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  const config: SupabaseConfig = {
    url: 'https://example.supabase.co',
    publishableKey: 'test-publishable-key',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('verifies the access token and returns its Supabase user', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      Response.json({
        id: 'user-id',
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { role: 'admin' },
        user_metadata: {},
        created_at: new Date().toISOString(),
      }),
    );
    const service = new SupabaseService(config);

    await expect(service.getUser('access-token')).resolves.toMatchObject({
      id: 'user-id',
      app_metadata: { role: 'admin' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/v1/user'),
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
