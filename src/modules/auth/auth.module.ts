import { Module } from '@nestjs/common';
import { getSmsHookConfig, SMS_HOOK_CONFIG } from './auth.config';
import { OtpDeliveryService } from './otp.delivery.service';
import { PublicSmsHookController } from './public/sms.hook.controller';
import { SmsHookService } from './sms.hook.service';

@Module({
  controllers: [PublicSmsHookController],
  providers: [
    {
      provide: SMS_HOOK_CONFIG,
      useFactory: getSmsHookConfig,
    },
    OtpDeliveryService,
    SmsHookService,
  ],
})
export class AuthModule {}
