import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../../shared/types/authenticated.request';
import { AuthIdentityDto } from '../dto/auth.identity.dto';

@ApiTags('Auth')
@ApiCookieAuth('access-token')
@Controller('auth')
export class PrivateAuthController {
  @Get('session')
  @ApiOperation({ summary: 'Return the current authenticated identity' })
  @ApiOkResponse({ type: AuthIdentityDto })
  @ApiUnauthorizedResponse({
    description: 'Access token cookie is missing, invalid, or expired',
  })
  getSession(@Req() request: AuthenticatedRequest): AuthIdentityDto {
    return {
      userId: request.user.id,
      isAdmin: request.user.app_metadata.role === 'admin',
    };
  }
}
