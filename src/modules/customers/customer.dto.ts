import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CustomerDto {
  /** Supabase Auth user id. */
  id: string;
  /** `380XXXXXXXXX`. */
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  /** Ukrainian ring size, e.g. 17.5. */
  ringSize: number | null;
  /** Default Nova Poshta city reference used to prefill checkout. */
  deliveryCityRef: string | null;
  deliveryCityName: string | null;
  deliveryWarehouseRef: string | null;
  deliveryWarehouseName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(30)
  ringSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryCityRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deliveryCityName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryWarehouseRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deliveryWarehouseName?: string;
}
