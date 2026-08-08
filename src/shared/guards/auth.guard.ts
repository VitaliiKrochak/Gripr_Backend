import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SupabaseService } from '../../integrations/supabase/supabase.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const ACCESS_TOKEN_COOKIE = 'access_token';

type RequestWithUser = Request &
  Partial<{
    accessToken: string;
    user: Awaited<ReturnType<SupabaseService['getUser']>>;
  }>;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const accessToken = request.cookies?.[ACCESS_TOKEN_COOKIE] as
      string | undefined;

    if (!accessToken) {
      throw new UnauthorizedException('Missing access token cookie');
    }

    try {
      request.user = await this.supabaseService.getUser(accessToken);
      request.accessToken = accessToken;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
