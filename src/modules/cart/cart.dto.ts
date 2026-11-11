import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { STORES } from '../../integrations/database/database.schema';
import type { Store } from '../../integrations/database/database.schema';
import { SelectedOptionDto } from '../storefront/storefront.dto';

export const MAX_LINE_QUANTITY = 10;

export class AddCartItemDto {
  @IsUUID()
  productId: string;

  /** Selected option value ids; required groups default when omitted. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  optionValueIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  engravingText?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity?: number;
}

export class UpdateCartItemDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  optionValueIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  engravingText?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity?: number;
}

export class CartItemDto {
  id: string;
  productId: string;
  productSlug: string | null;
  productName: string | null;
  imageUrl: string | null;
  optionValueIds: string[];
  selectedOptions: SelectedOptionDto[];
  engravingText: string | null;
  quantity: number;
  /** Price of one piece, in kopiykas. */
  unitPrice: number;
  /** Set discount applied to this line, in kopiykas. */
  discount: number;
  lineTotal: number;
  productionDaysMin: number;
  productionDaysMax: number;
  /** Ships from ready stock without production. */
  fromStock: boolean;
  /** Non-null when the line cannot be ordered; remove or edit it. */
  unavailableReason: string | null;
}

export class CartPrintItemDto {
  /** Print request item id. */
  id: string;
  fileName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  selectedOptions: SelectedOptionDto[];
}

/** A confirmed Gripr Lab print request; it is ordered as a whole. */
export class CartPrintDto {
  requestId: string;
  @ApiProperty({ type: [CartPrintItemDto] })
  items: CartPrintItemDto[];
  /** The confirmed price in kopiykas. */
  total: number;
  productionDaysMin: number;
  productionDaysMax: number;
  priceValidUntil: Date | null;
  /** Non-null when the price expired; the Lab checks it again. */
  unavailableReason: string | null;
}

/** The lines of one store; each store is checked out separately. */
export class CartDto {
  @ApiProperty({ enum: STORES })
  store: Store;
  items: CartItemDto[];
  /** Confirmed print requests of the Lab cart; always empty for Gripr. */
  @ApiProperty({ type: [CartPrintDto] })
  prints: CartPrintDto[];
  /** Includes the available prints. */
  subtotal: number;
  discount: number;
  total: number;
  /** Estimate for the whole order; pieces are made in parallel. */
  productionDaysMin: number;
  productionDaysMax: number;
  hasUnavailableItems: boolean;
}
