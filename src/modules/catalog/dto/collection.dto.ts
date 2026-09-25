import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PUBLICATION_STATUSES } from '../../../integrations/database/database.schema';
import type { PublicationStatus } from '../../../integrations/database/database.schema';
import { ImageAssetDto } from '../../../shared/media/image.asset.dto';
import { SLUG_MESSAGE, SLUG_PATTERN } from './reference.dto';

export class CreateCollectionDto {
  @Matches(SLUG_PATTERN, { message: `slug ${SLUG_MESSAGE}` })
  @MaxLength(100)
  slug: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subtitle?: string;

  /** Story text shown on the collection page. */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImageAssetDto)
  coverImage?: ImageAssetDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageAssetDto)
  gallery?: ImageAssetDto[];

  @ApiProperty({ enum: PUBLICATION_STATUSES, required: false })
  @IsOptional()
  @IsIn(PUBLICATION_STATUSES)
  status?: PublicationStatus;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  /** A set can be bought as a whole with `setDiscountPercent` off. */
  @IsOptional()
  @IsBoolean()
  isSet?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  setDiscountPercent?: number;

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
}

export class UpdateCollectionDto extends PartialType(CreateCollectionDto) {}

export class CollectionListQueryDto {
  @ApiProperty({ enum: PUBLICATION_STATUSES, required: false })
  @IsOptional()
  @IsIn(PUBLICATION_STATUSES)
  status?: PublicationStatus;
}

export class ImageDto {
  publicId: string;
  url: string;
  alt?: string;
}

export class CollectionDto {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  coverImage: ImageDto | null;
  gallery: ImageDto[];
  @ApiProperty({ enum: PUBLICATION_STATUSES })
  status: PublicationStatus;
  isFeatured: boolean;
  isSet: boolean;
  setDiscountPercent: number;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AdminCollectionDto extends CollectionDto {
  productCount: number;
}
