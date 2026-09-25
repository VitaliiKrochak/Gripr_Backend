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

export class CartDto {
  items: CartItemDto[];
  subtotal: number;
  discount: number;
  total: number;
  /** Estimate for the whole order; pieces are made in parallel. */
  productionDaysMin: number;
  productionDaysMax: number;
  hasUnavailableItems: boolean;
}
