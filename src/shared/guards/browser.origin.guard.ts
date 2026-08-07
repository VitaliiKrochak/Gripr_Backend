import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { getAllowedFrontendOrigins } from '../origins/frontend.origin';

@Injectable()
export class BrowserOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;

    if (
      !origin ||
      origin === 'null' ||
      !getAllowedFrontendOrigins().includes(origin)
    ) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    return true;
  }
}
