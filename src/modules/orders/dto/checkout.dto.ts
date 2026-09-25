import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DeliveryAddressDto {
  /** Nova Poshta city `Ref`. */
  @IsString()
  @MaxLength(100)
  cityRef: string;

  @IsString()
  @MaxLength(255)
  cityName: string;

  /** Nova Poshta branch or parcel locker `Ref`. */
  @IsString()
  @MaxLength(100)
  warehouseRef: string;

  @IsString()
  @MaxLength(255)
  warehouseName: string;
}

export class OrderContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  contactName: string;

  /** Defaults to the phone number used to sign in. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  delivery: DeliveryAddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  /** Stores the delivery address as the profile default. */
  @IsOptional()
  @IsBoolean()
  saveAsDefault?: boolean;
}

export class CheckoutDto extends OrderContactDto {}
