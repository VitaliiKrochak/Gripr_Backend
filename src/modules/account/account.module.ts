import { Module } from '@nestjs/common';
import { BrowserOriginGuard } from '../../shared/guards/browser.origin.guard';
import { AccountAuthService } from './account.auth.service';
import { PrivateAuthController } from './private/auth.controller';
import { PublicAuthController } from './public/auth.controller';

@Module({
  controllers: [PublicAuthController, PrivateAuthController],
  providers: [AccountAuthService, BrowserOriginGuard],
})
export class AccountModule {}
