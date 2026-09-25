import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  OPTION_GROUP_KINDS,
  PRODUCT_AVAILABILITIES,
  PRODUCT_TYPES,
} from '../../integrations/database/database.schema';
import type {
  OptionGroupKind,
  ProductAvailability,
  ProductType,
} from '../../integrations/database/database.schema';
import { PaginationQueryDto } from '../../shared/pagination/pagination.query.dto';
import { ImageDto } from '../catalog/dto/collection.dto';
import { ProductCardDto } from '../catalog/dto/product.card.dto';
import { ProductSpecificationDto } from '../catalog/dto/product.dto';
import { GemstoneDto, MetalDto, TagDto } from '../catalog/dto/reference.dto';

export const PRODUCT_SORTS = [
  'featured',
  'newest',
  'price_asc',
  'price_desc',
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

const toArray = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : value;

const toBoolean = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : value === true || value === 'true';

export class StorefrontProductQueryDto extends PaginationQueryDto {
  /** Collection slug. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  collection?: string;

  /** Tag slugs; comma-separated or repeated. Matches any of them. */
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ enum: PRODUCT_TYPES, required: false })
  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  type?: ProductType;

  /** Metal codes; comma-separated or repeated. */
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  metals?: string[];

  /** Gemstone codes; comma-separated or repeated. */
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  gemstones?: string[];

  /** Minimum "price from", in kopiykas. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMin?: number;

  /** Maximum "price from", in kopiykas. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMax?: number;

  /** `true` returns only ready pieces that ship without production. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hot?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  new?: boolean;

  /** Searches product names and short descriptions. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiProperty({ enum: PRODUCT_SORTS, required: false, default: 'featured' })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;
}

export class QuoteRequestDto {
  /** Selected option value ids; required groups default when omitted. */
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  optionValueIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  engravingText?: string;
}

export class SelectedOptionDto {
  groupId: string;
  groupName: string;
  @ApiProperty({ enum: OPTION_GROUP_KINDS })
  kind: string;
  valueId: string;
  label: string;
  priceDelta: number;
}

export class QuoteDto {
  /** Price of one piece in this configuration, in kopiykas. */
  unitPrice: number;
  productionDaysMin: number;
  productionDaysMax: number;
  /** Effective selection including defaults. */
  optionValueIds: string[];
  selectedOptions: SelectedOptionDto[];
  engravingText: string | null;
}

export class StorefrontOptionValueDto {
  id: string;
  label: string;
  metal: MetalDto | null;
  gemstone: GemstoneDto | null;
  stoneCarat: number | null;
  stoneSizeMm: number | null;
  ringSize: number | null;
  priceDelta: number;
  productionDaysDelta: number;
  isDefault: boolean;
}

export class StorefrontOptionGroupDto {
  id: string;
  @ApiProperty({ enum: OPTION_GROUP_KINDS })
  kind: OptionGroupKind;
  name: string;
  isRequired: boolean;
  values: StorefrontOptionValueDto[];
}

export class StorefrontImageDto {
  id: string;
  url: string;
  alt: string | null;
  /** When set, show the image only for this selected option value. */
  optionValueId: string | null;
}

export class StorefrontCollectionSummaryDto {
  slug: string;
  name: string;
  isSet: boolean;
  setDiscountPercent: number;
}

export class StorefrontProductDto {
  id: string;
  slug: string;
  name: string;
  @ApiProperty({ enum: PRODUCT_TYPES })
  type: ProductType;
  shortDescription: string | null;
  description: string | null;
  specifications: ProductSpecificationDto[];
  @ApiProperty({ enum: PRODUCT_AVAILABILITIES })
  availability: ProductAvailability;
  inStock: boolean;
  isHot: boolean;
  isNew: boolean;
  isFeatured: boolean;
  basePrice: number;
  productionDaysMin: number;
  productionDaysMax: number;
  seoTitle: string | null;
  seoDescription: string | null;
  collection: StorefrontCollectionSummaryDto | null;
  tags: TagDto[];
  images: StorefrontImageDto[];
  optionGroups: StorefrontOptionGroupDto[];
  /** Price and timing of the default configuration, if it is valid. */
  defaultQuote: QuoteDto | null;
}

export class StorefrontCollectionDto {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  coverImage: ImageDto | null;
  gallery: ImageDto[];
  isFeatured: boolean;
  isSet: boolean;
  setDiscountPercent: number;
  seoTitle: string | null;
  seoDescription: string | null;
  productCount: number;
}

export class StorefrontCollectionDetailsDto extends StorefrontCollectionDto {
  products: ProductCardDto[];
  /** Sum of "price from" of all pieces, for sets. */
  setPrice: number | null;
  /** `setPrice` after the set discount. */
  setPriceDiscounted: number | null;
}

export class StorefrontHomeDto {
  featuredCollections: StorefrontCollectionDto[];
  hotProducts: ProductCardDto[];
  newProducts: ProductCardDto[];
  featuredProducts: ProductCardDto[];
}

export class PriceRangeDto {
  min: number;
  max: number;
}

export class StorefrontFiltersDto {
  @ApiProperty({ enum: PRODUCT_TYPES, isArray: true })
  types: ProductType[];
  tags: TagDto[];
  metals: MetalDto[];
  gemstones: GemstoneDto[];
  collections: StorefrontCollectionSummaryDto[];
  priceRange: PriceRangeDto;
}
