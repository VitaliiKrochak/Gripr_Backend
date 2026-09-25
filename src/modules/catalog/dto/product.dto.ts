import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
import {
  SLUG_MESSAGE,
  SLUG_PATTERN,
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

  /** Free-form characteristics, e.g. weight or dimensions. */
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

  /** Price of the default configuration in kopiykas. */
  @IsInt()
  @Min(0)
  basePrice: number;

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

export class ReorderDto {
  /** Ids in the desired display order. */
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids: string[];
}

export class CreateOptionGroupDto {
  @ApiProperty({ enum: OPTION_GROUP_KINDS })
  @IsIn(OPTION_GROUP_KINDS)
  kind: OptionGroupKind;

  /** Label shown in the configurator, e.g. "Метал" or "Розмір". */
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateOptionGroupDto extends PartialType(CreateOptionGroupDto) {}

export class CreateOptionValueDto {
  @IsString()
  @MaxLength(100)
  label: string;

  @IsOptional()
  @IsUUID()
  metalId?: string | null;

  @IsOptional()
  @IsUUID()
  gemstoneId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stoneCarat?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stoneSizeMm?: number | null;

  /** Ukrainian ring size, e.g. 17.5. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  ringSize?: number | null;

  /** Added to the base price, in kopiykas. May be negative. */
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

export class OptionValueDto {
  id: string;
  groupId: string;
  label: string;
  metalId: string | null;
  gemstoneId: string | null;
  metal: MetalDto | null;
  gemstone: GemstoneDto | null;
  stoneCarat: number | null;
  stoneSizeMm: number | null;
  ringSize: number | null;
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
  basePrice: number;
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
  optionGroups: OptionGroupDto[];
}
