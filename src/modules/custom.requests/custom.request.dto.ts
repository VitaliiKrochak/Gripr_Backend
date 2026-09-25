import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CUSTOM_REQUEST_STATUSES,
  PRODUCT_TYPES,
} from '../../integrations/database/database.schema';
import type {
  CustomRequestStatus,
  ProductType,
} from '../../integrations/database/database.schema';
import { PaginationQueryDto } from '../../shared/pagination/pagination.query.dto';
import { ImageAssetDto } from '../../shared/media/image.asset.dto';
import { ImageDto } from '../catalog/dto/collection.dto';
import { OrderContactDto } from '../orders/dto/checkout.dto';

export class CreateCustomRequestDto {
  @ApiProperty({ enum: PRODUCT_TYPES })
  @IsIn(PRODUCT_TYPES)
  productType: ProductType;

  /** What the customer wants: idea, style, occasion, stones. */
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  /** Images uploaded with `POST /customers/me/uploads/signature`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ImageAssetDto)
  referenceImages?: ImageAssetDto[];

  /** In kopiykas. */
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMin?: number;

  /** In kopiykas. */
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  desiredMetal?: string;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(30)
  ringSize?: number;
}

export class CustomRequestQuoteDto {
  title: string | null;
  /** In kopiykas. */
  price: number | null;
  /** In kopiykas; paid first, the remainder later. */
  depositAmount: number | null;
  productionDaysMin: number | null;
  productionDaysMax: number | null;
  note: string | null;
}

export class CustomRequestDto {
  id: string;
  @ApiProperty({ enum: CUSTOM_REQUEST_STATUSES })
  status: CustomRequestStatus;
  @ApiProperty({ enum: PRODUCT_TYPES })
  productType: ProductType;
  description: string;
  referenceImages: ImageDto[];
  budgetMin: number | null;
  budgetMax: number | null;
  desiredMetal: string | null;
  ringSize: number | null;
  /** Present once the request is quoted. */
  quote: CustomRequestQuoteDto | null;
  /** The order created when the quote was accepted. */
  orderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CustomRequestPageDto {
  @ApiProperty({ type: [CustomRequestDto] })
  items: CustomRequestDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class CustomRequestCustomerDto {
  id: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
}

export class AdminCustomRequestDto extends CustomRequestDto {
  adminNote: string | null;
  customer: CustomRequestCustomerDto;
}

export class AdminCustomRequestPageDto {
  @ApiProperty({ type: [AdminCustomRequestDto] })
  items: AdminCustomRequestDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class AdminCustomRequestListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @ApiProperty({ enum: CUSTOM_REQUEST_STATUSES, required: false })
  @IsIn(CUSTOM_REQUEST_STATUSES)
  status?: CustomRequestStatus;
}

export class UpdateCustomRequestDto {
  @IsOptional()
  @ApiProperty({ enum: ['in_review', 'rejected'], required: false })
  @IsIn(['in_review', 'rejected'])
  status?: 'in_review' | 'rejected';

  /** Internal note, never shown to the customer. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminNote?: string;
}

export class QuoteCustomRequestDto {
  /** Order item name, e.g. `Каблучка з сапфіром на замовлення`. */
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  /** Total price in kopiykas. */
  @IsInt()
  @Min(1)
  price: number;

  /** Deposit in kopiykas; omit to require full payment. */
  @IsOptional()
  @IsInt()
  @Min(1)
  depositAmount?: number;

  @IsInt()
  @Min(1)
  productionDaysMin: number;

  @IsInt()
  @Min(1)
  productionDaysMax: number;

  /** Explanation shown to the customer. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}

export class AcceptCustomRequestDto extends OrderContactDto {}
