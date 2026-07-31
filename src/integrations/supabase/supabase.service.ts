import { Inject, Injectable } from '@nestjs/common';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import type { AuthResponse } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './supabase.config';
import type { SupabaseConfig } from './supabase.config';

@Injectable()
export class SupabaseService {
  readonly adminClient: SupabaseClient<any, any, any, any, any>;

  constructor(
    @Inject(SUPABASE_CONFIG) private readonly config: SupabaseConfig,
  ) {
    this.adminClient = createClient(config.url, config.secretKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  async signUp(email: string, password: string): Promise<AuthResponse['data']> {
    const { data, error } = await this.createPublicClient().auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async signInWithPassword(
    email: string,
    password: string,
  ): Promise<AuthResponse['data']> {
    const { data, error } =
      await this.createPublicClient().auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      throw error;
    }

    return data;
  }

  async refreshSession(refreshToken: string): Promise<AuthResponse['data']> {
    const { data, error } = await this.createPublicClient().auth.refreshSession(
      {
        refresh_token: refreshToken,
      },
    );

    if (error) {
      throw error;
    }

    return data;
  }

  async signOut(accessToken: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.signOut(
      accessToken,
      'local',
    );

    if (error) {
      throw error;
    }
  }

  async getUser(accessToken: string): Promise<User> {
    const { data, error } = await this.adminClient.auth.getUser(accessToken);

    if (error || !data.user) {
      throw error ?? new Error('Supabase did not return a user');
    }

    return data.user;
  }

  private createPublicClient(): SupabaseClient<any, any, any, any, any> {
    return createClient(this.config.url, this.config.publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }
}
