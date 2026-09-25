import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  ORDER_KINDS,
  ORDER_STATUSES,
} from '../../../integrations/database/database.schema';
import type {
  OrderKind,
  OrderStatus,
} from '../../../integrations/database/database.schema';
import { PaginationQueryDto } from '../../../shared/pagination/pagination.query.dto';

export class AdminOrderListQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: ORDER_STATUSES, required: false })
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;

  @ApiProperty({ enum: ORDER_KINDS, required: false })
  @IsOptional()
  @IsIn(ORDER_KINDS)
  kind?: OrderKind;

  /** Orders created at or after this ISO date-time. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdFrom?: Date;

  /** Orders created before this ISO date-time. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdTo?: Date;

  /** Order number, contact phone, or contact name. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ChangeOrderStatusDto {
  @ApiProperty({ enum: ORDER_STATUSES })
  @IsIn(ORDER_STATUSES)
  status: OrderStatus;

  /** Shown to the customer in the order history. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateOrderDeliveryDto {
  /** Nova Poshta TTN (14 digits). */
  @IsOptional()
  @Matches(/^\d{14}$/, { message: 'trackingNumber must contain 14 digits' })
  trackingNumber?: string;

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

export class UpdateOrderDto {
  /** Internal note, never shown to the customer. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminNote?: string;
}
