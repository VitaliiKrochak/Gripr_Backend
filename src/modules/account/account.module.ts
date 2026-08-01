import { Module } from '@nestjs/common';
import { AccountAuthService } from './account.auth.service';
import { PublicAuthController } from './public/auth.controller';

@Module({
  controllers: [PublicAuthController],
  providers: [AccountAuthService],
})
export class AccountModule {}
