import { ApiProperty } from '@nestjs/swagger';
import {
  PRODUCT_AVAILABILITIES,
  PRODUCT_TYPES,
  STORES,
} from '../../../integrations/database/database.schema';
import type {
  ProductAvailability,
  ProductType,
  Store,
} from '../../../integrations/database/database.schema';

export class ProductCardImageDto {
  url: string;
  alt: string | null;
}

export class ProductCardMetalDto {
  code: string;
  name: string;
  /** Display colour of the metal (CSS colour), when set in reference data. */
  @ApiProperty({ type: String, nullable: true })
  color: string | null;
}

export class ProductCardCollectionDto {
  slug: string;
  name: string;
}

/** Compact product representation for grids, carousels, and favorites. */
export class ProductCardDto {
  id: string;
  @ApiProperty({ enum: STORES })
  store: Store;
  slug: string;
  name: string;
  @ApiProperty({ enum: PRODUCT_TYPES })
  type: ProductType;
  shortDescription: string | null;
  /** Price of the default configuration, in kopiykas. */
  priceFrom: number;
  productionDaysMin: number;
  productionDaysMax: number;
  @ApiProperty({ enum: PRODUCT_AVAILABILITIES })
  availability: ProductAvailability;
  /** `true` when a ready piece can be shipped without production. */
  inStock: boolean;
  isHot: boolean;
  isNew: boolean;
  isFeatured: boolean;
  /** Up to two general images (not tied to a specific option). */
  images: ProductCardImageDto[];
  /** Metals the piece can be ordered in. */
  metals: ProductCardMetalDto[];
  collection: ProductCardCollectionDto | null;
}

export class ProductCardPageDto {
  items: ProductCardDto[];
  total: number;
  page: number;
  pageSize: number;
}
