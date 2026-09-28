import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  OPTION_GROUP_KINDS,
  PRODUCT_AVAILABILITIES,
  PRODUCT_TYPES,
  PUBLICATION_STATUSES,
} from '../../../integrations/database/database.schema';
import type {
  OptionGroupKind,
  ProductAvailability,
  ProductType,
  PublicationStatus,
} from '../../../integrations/database/database.schema';
import { PaginationQueryDto } from '../../../shared/pagination/pagination.query.dto';
import { DesignCreditDto } from '../../designs/dto/design.credit.dto';
import {
  SLUG_MESSAGE,
  SLUG_PATTERN,
  FinishingOptionDto,
  GemstoneDto,
  MetalDto,
  TagDto,
} from './reference.dto';

export class ProductSpecificationDto {
  @IsString()
  @MaxLength(100)
  label: string;

  @IsString()
  @MaxLength(255)
  value: string;
}

export class CreateProductImageDto {
  @IsString()
  @MaxLength(255)
  publicId: string;

  @IsString()
  @MaxLength(1000)
  @Matches(/^https:\/\//, { message: 'url must be an https URL' })
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt?: string;

  /** Shows this image only when the option value is selected (e.g. a metal). */
  @IsOptional()
  @IsUUID()
  optionValueId?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateProductImageDto extends PartialType(
  OmitType(CreateProductImageDto, ['publicId', 'url'] as const),
) {}

export class CreateOptionGroupDto {
  @ApiProperty({ enum: OPTION_GROUP_KINDS })
  @IsIn(OPTION_GROUP_KINDS)
  kind: OptionGroupKind;

  /**
   * Heading shown in the configurator, e.g. "Метал" or "Розмір". Defaults
   * to the name of the kind.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateOptionGroupDto extends PartialType(CreateOptionGroupDto) {}

export class CreateOptionValueDto {
  /**
   * Shown to customers. Defaults to the metal, stone, operation, or size
   * name; required for `custom` groups.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsUUID()
  metalId?: string | null;

  @IsOptional()
  @IsUUID()
  gemstoneId?: string | null;

  /** Engraving, coating, or processing operation. */
  @IsOptional()
  @IsUUID()
  finishingId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stoneCarat?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stoneSizeMm?: number | null;

  /** Ring size (e.g. 17.5) or length in cm (e.g. 45), by product type. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  sizeValue?: number | null;

  /** Extra metal in grams when selected; may be negative for smaller sizes. */
  @IsOptional()
  @IsNumber()
  weightDeltaGrams?: number;

  /** Added to the price, in kopiykas. May be negative. */
  @IsOptional()
  @IsInt()
  priceDelta?: number;

  @IsOptional()
  @IsInt()
  productionDaysDelta?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateOptionValueDto extends PartialType(CreateOptionValueDto) {}

/**
 * Items of the full-configuration save. Rows with a known `id` are updated,
 * rows with a new client-generated `id` or without one are created, and
 * existing rows missing from the list are deleted. Array order is the
 * display order.
 */
export class ProductOptionValueInputDto extends OmitType(CreateOptionValueDto, [
  'sortOrder',
] as const) {
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class ProductOptionGroupInputDto extends OmitType(CreateOptionGroupDto, [
  'sortOrder',
] as const) {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProductOptionValueInputDto)
  values: ProductOptionValueInputDto[];
}

export class ProductImageInputDto extends OmitType(CreateProductImageDto, [
  'sortOrder',
] as const) {
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class ProductStoneInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
  gemstoneId: string;

  /** Quality, cut, or colour grade, e.g. `VS1, G`. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  variation?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sizeMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  carat?: number | null;

  @IsInt()
  @Min(1)
  quantity: number;

  /** Price of one stone including setting, in kopiykas. */
  @IsInt()
  @Min(0)
  unitPrice: number;
}

export class CreateProductDto {
  @Matches(SLUG_PATTERN, { message: `slug ${SLUG_MESSAGE}` })
  @MaxLength(120)
  slug: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: PRODUCT_TYPES })
  @IsIn(PRODUCT_TYPES)
  type: ProductType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  /** Long story text about the piece. */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  /** Characteristics not covered by structured product data. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSpecificationDto)
  specifications?: ProductSpecificationDto[];

  @IsOptional()
  @IsUUID()
  collectionId?: string | null;

  @ApiProperty({ enum: PUBLICATION_STATUSES, required: false })
  @IsOptional()
  @IsIn(PUBLICATION_STATUSES)
  status?: PublicationStatus;

  @IsOptional()
  @IsBoolean()
  isHot?: boolean;

  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  /**
   * Manufacturing (labour) price in kopiykas. The final price adds metal by
   * weight, stones, and selected option surcharges.
   */
  @IsInt()
  @Min(0)
  basePrice: number;

  /** Approximate metal weight of the default size, in grams. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightGrams?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  widthMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  heightMm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  productionDaysMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  productionDaysMax?: number;

  @ApiProperty({ enum: PRODUCT_AVAILABILITIES, required: false })
  @IsOptional()
  @IsIn(PRODUCT_AVAILABILITIES)
  availability?: ProductAvailability;

  /** Ready pieces available when `availability` is `in_stock`. */
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  /** Empty values are generated from the product name and type. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  tagIds?: string[];

  /** Replaces the fixed stone composition. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProductStoneInputDto)
  stones?: ProductStoneInputDto[];

  /** Replaces the configurator option groups with their values. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProductOptionGroupInputDto)
  optionGroups?: ProductOptionGroupInputDto[];

  /** Replaces the attached images; array order is the gallery order. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  images?: ProductImageInputDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class AdminProductListQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: PUBLICATION_STATUSES, required: false })
  @IsOptional()
  @IsIn(PUBLICATION_STATUSES)
  status?: PublicationStatus;

  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @ApiProperty({ enum: PRODUCT_TYPES, required: false })
  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  type?: ProductType;

  /** Searches name and slug. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ReorderDto {
  /** Ids in the desired display order. */
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids: string[];
}

export class OptionValueDto {
  id: string;
  groupId: string;
  label: string;
  metalId: string | null;
  gemstoneId: string | null;
  finishingId: string | null;
  metal: MetalDto | null;
  gemstone: GemstoneDto | null;
  finishing: FinishingOptionDto | null;
  stoneCarat: number | null;
  stoneSizeMm: number | null;
  sizeValue: number | null;
  weightDeltaGrams: number;
  priceDelta: number;
  productionDaysDelta: number;
  isDefault: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

export class OptionGroupDto {
  id: string;
  productId: string;
  @ApiProperty({ enum: OPTION_GROUP_KINDS })
  kind: OptionGroupKind;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  values: OptionValueDto[];
}

export class ProductStoneDto {
  id: string;
  gemstoneId: string;
  gemstone: GemstoneDto;
  variation: string | null;
  sizeMm: number | null;
  carat: number | null;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
}

export class ProductImageDto {
  id: string;
  publicId: string;
  url: string;
  alt: string | null;
  optionValueId: string | null;
  sortOrder: number;
}

export class ProductCollectionSummaryDto {
  id: string;
  slug: string;
  name: string;
}

export class AdminProductListItemDto {
  id: string;
  slug: string;
  name: string;
  @ApiProperty({ enum: PRODUCT_TYPES })
  type: ProductType;
  @ApiProperty({ enum: PUBLICATION_STATUSES })
  status: PublicationStatus;
  basePrice: number;
  /** Price of the default configuration. */
  priceFrom: number;
  @ApiProperty({ enum: PRODUCT_AVAILABILITIES })
  availability: ProductAvailability;
  stockQuantity: number;
  isHot: boolean;
  isNew: boolean;
  isFeatured: boolean;
  sortOrder: number;
  collectionId: string | null;
  imageUrl: string | null;
  updatedAt: Date;
}

export class AdminProductPageDto {
  items: AdminProductListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class AdminProductDto {
  id: string;
  slug: string;
  name: string;
  @ApiProperty({ enum: PRODUCT_TYPES })
  type: ProductType;
  shortDescription: string | null;
  description: string | null;
  specifications: ProductSpecificationDto[];
  collectionId: string | null;
  collection: ProductCollectionSummaryDto | null;
  @ApiProperty({ enum: PUBLICATION_STATUSES })
  status: PublicationStatus;
  isHot: boolean;
  isNew: boolean;
  isFeatured: boolean;
  /** Manufacturing price. */
  basePrice: number;
  /** Price of the default configuration. */
  priceFrom: number;
  weightGrams: number | null;
  widthMm: number | null;
  heightMm: number | null;
  productionDaysMin: number;
  productionDaysMax: number;
  @ApiProperty({ enum: PRODUCT_AVAILABILITIES })
  availability: ProductAvailability;
  stockQuantity: number;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tags: TagDto[];
  images: ProductImageDto[];
  stones: ProductStoneDto[];
  optionGroups: OptionGroupDto[];
  /** Set when the product was made from an imported open-license design. */
  @ApiProperty({ type: DesignCreditDto, nullable: true })
  designCredit: DesignCreditDto | null;
}
