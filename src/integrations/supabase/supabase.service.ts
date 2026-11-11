import { Inject, Injectable } from '@nestjs/common';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './supabase.config';
import type { SupabaseConfig } from './supabase.config';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient<any, any, any, any, any>;

  constructor(@Inject(SUPABASE_CONFIG) config: SupabaseConfig) {
    this.client = createClient(config.url, config.publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  /**
   * Verifies the access token and returns its user. With the project's
   * asymmetric signing key the signature and expiry are checked locally
   * against the cached JWKS (refreshed every 10 minutes), so no request
   * reaches Supabase Auth per API call; a symmetric key falls back to the
   * Auth server. The user is built from the token claims: `app_metadata`
   * changes apply once the token is refreshed (at most its lifetime).
   */
  async getUser(accessToken: string): Promise<User> {
    const { data, error } = await this.client.auth.getClaims(accessToken);

    if (error || !data?.claims.sub) {
      throw error ?? new Error('Supabase did not verify the access token');
    }

    const { claims } = data;

    return {
      id: claims.sub,
      aud: typeof claims.aud === 'string' ? claims.aud : 'authenticated',
      role: claims.role,
      email: claims.email || undefined,
      phone: claims.phone || undefined,
      app_metadata: claims.app_metadata ?? {},
      user_metadata: claims.user_metadata ?? {},
      is_anonymous: claims.is_anonymous,
      created_at: '',
    };
  }
}
