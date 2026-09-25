import { Type } from 'class-transformer';
import { IsString, Matches, ValidateNested } from 'class-validator';

export class SmsHookUserDto {
  @IsString()
  phone: string;
}

export class SmsHookSmsDto {
  @Matches(/^\d{4,8}$/)
  otp: string;
}

/** Payload of the Supabase Auth "Send SMS" hook. */
export class SmsHookDto {
  @ValidateNested()
  @Type(() => SmsHookUserDto)
  user: SmsHookUserDto;

  @ValidateNested()
  @Type(() => SmsHookSmsDto)
  sms: SmsHookSmsDto;
}
