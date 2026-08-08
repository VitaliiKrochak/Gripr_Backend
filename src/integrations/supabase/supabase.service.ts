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

  async getUser(accessToken: string): Promise<User> {
    const { data, error } = await this.client.auth.getUser(accessToken);

    if (error || !data.user) {
      throw error ?? new Error('Supabase did not return a user');
    }

    return data.user;
  }
}
