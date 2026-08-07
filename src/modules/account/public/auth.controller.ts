import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from '../../../shared/cookies/auth.cookie';
import { Public } from '../../../shared/decorators/public.decorator';
import { BrowserOriginGuard } from '../../../shared/guards/browser.origin.guard';
import { AuthResult } from '../account.auth.service';
import { AccountAuthService } from '../account.auth.service';
import { AuthCredentialsDto } from '../dto/auth.credentials.dto';
import { AuthSessionDto } from '../dto/auth.session.dto';

@Public()
@UseGuards(BrowserOriginGuard)
@ApiTags('Auth')
@ApiForbiddenResponse({
  description: 'The request Origin is missing or is not allowed',
})
@Controller('auth')
export class PublicAuthController {
  constructor(private readonly accountAuthService: AccountAuthService) {}

  @Post('sign-up')
  @ApiOperation({ summary: 'Create a customer account' })
  @ApiCreatedResponse({
    type: AuthSessionDto,
    description: 'Account created; auth cookies are set when a session exists',
  })
  @ApiBadRequestResponse({ description: 'Account could not be created' })
  async signUp(
    @Body() body: AuthCredentialsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const result = await this.accountAuthService.signUp(
      body.email,
      body.password,
    );
    setAuthCookies(response, result);
    return this.toDto(result);
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in and set HttpOnly auth cookies' })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async signIn(
    @Body() body: AuthCredentialsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const result = await this.accountAuthService.signIn(
      body.email,
      body.password,
    );
    setAuthCookies(response, result);
    return this.toDto(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh-token')
  @ApiOperation({
    summary: 'Rotate the session using the refresh-token cookie',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({
    description: 'Refresh token cookie is missing, invalid, or expired',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE] as
      string | undefined;

    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token cookie');
    }

    const result = await this.accountAuthService.refresh(refreshToken);
    setAuthCookies(response, result);
    return this.toDto(result);
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('access-token')
  @ApiOperation({ summary: 'Sign out and clear auth cookies' })
  @ApiNoContentResponse({ description: 'Signed out' })
  @ApiBadRequestResponse({ description: 'Supabase could not end the session' })
  async signOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const accessToken = request.cookies?.[ACCESS_TOKEN_COOKIE] as
      string | undefined;

    try {
      if (accessToken) {
        await this.accountAuthService.signOut(accessToken);
      }
    } finally {
      clearAuthCookies(response);
    }
  }

  private toDto(result: AuthResult): AuthSessionDto {
    return {
      userId: result.userId,
      expiresAt: result.expiresAt,
    };
  }
}
