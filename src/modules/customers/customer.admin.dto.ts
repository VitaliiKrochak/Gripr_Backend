import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ORDER_STATUSES } from '../../integrations/database/database.schema';
import type { OrderStatus } from '../../integrations/database/database.schema';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../shared/pagination/pagination.query.dto';
import { CustomerDto } from './customer.dto';

export class CustomerListQueryDto extends PaginationQueryDto {
  /** Searches phone, name, and email. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CustomerListItemDto extends CustomerDto {
  orderCount: number;
  /** Sum of successful payments, in kopiykas. */
  totalPaid: number;
}

export class CustomerPageDto {
  items: CustomerListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class CustomerOrderSummaryDto {
  id: string;
  number: number;
  @ApiProperty({ enum: ORDER_STATUSES })
  status: OrderStatus;
  total: number;
  paidAmount: number;
  createdAt: Date;
}

export class CustomerDetailsDto extends CustomerListItemDto {
  orders: CustomerOrderSummaryDto[];
}
