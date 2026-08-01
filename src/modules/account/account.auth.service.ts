import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthResponse } from '@supabase/supabase-js';
import { SupabaseService } from '../../integrations/supabase/supabase.service';

export interface AuthResult {
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

@Injectable()
export class AccountAuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async signUp(email: string, password: string): Promise<AuthResult> {
    try {
      const data = await this.supabaseService.signUp(email, password);
      return this.toAuthSession(data);
    } catch {
      throw new BadRequestException('Unable to create account');
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const data = await this.supabaseService.signInWithPassword(
        email,
        password,
      );
      return this.toAuthSession(data);
    } catch {
      throw new UnauthorizedException('Invalid email or password');
    }
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    try {
      const data = await this.supabaseService.refreshSession(refreshToken);
      return this.toAuthSession(data);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async signOut(accessToken: string): Promise<void> {
    try {
      await this.supabaseService.signOut(accessToken);
    } catch {
      throw new BadRequestException('Unable to sign out');
    }
  }

  private toAuthSession(data: AuthResponse['data']): AuthResult {
    if (!data.user) {
      throw new BadRequestException('Supabase did not return a user');
    }

    return {
      userId: data.user.id,
      accessToken: data.session?.access_token ?? null,
      refreshToken: data.session?.refresh_token ?? null,
      expiresAt: data.session?.expires_at ?? null,
    };
  }
}
