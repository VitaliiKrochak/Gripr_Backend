import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  DESIGN_IP_RISKS,
  DESIGN_LICENSES,
  DESIGN_SOURCES,
  DESIGN_STATUSES,
  PRODUCT_TYPES,
  STORES,
} from '../../../integrations/database/database.schema';
import type {
  DesignIpRisk,
  DesignLicense,
  DesignSource,
  DesignStatus,
  ProductType,
  Store,
} from '../../../integrations/database/database.schema';
import { StorePageQueryDto } from '../../../shared/store/store.query.dto';

export const DESIGN_CANDIDATE_SORTS = ['score', 'likes', 'newest'] as const;
export type DesignCandidateSort = (typeof DESIGN_CANDIDATE_SORTS)[number];

export class DesignCandidateListQueryDto extends StorePageQueryDto {
  @ApiProperty({ enum: DESIGN_STATUSES, required: false, default: 'candidate' })
  @IsOptional()
  @IsIn(DESIGN_STATUSES)
  status: DesignStatus = 'candidate';

  @ApiProperty({ enum: PRODUCT_TYPES, required: false })
  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  type?: ProductType;

  @ApiProperty({ enum: DESIGN_LICENSES, required: false })
  @IsOptional()
  @IsIn(DESIGN_LICENSES)
  license?: DesignLicense;

  /** `blocked` candidates are listed only when requested explicitly. */
  @ApiProperty({ enum: DESIGN_IP_RISKS, required: false })
  @IsOptional()
  @IsIn(DESIGN_IP_RISKS)
  ipRisk?: DesignIpRisk;

  /** Searches title, author, and tags. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiProperty({
    enum: DESIGN_CANDIDATE_SORTS,
    required: false,
    default: 'score',
  })
  @IsOptional()
  @IsIn(DESIGN_CANDIDATE_SORTS)
  sort: DesignCandidateSort = 'score';
}

export class ApproveDesignCandidateDto {
  /** Must be a product type of the candidate's store. */
  @ApiProperty({ enum: PRODUCT_TYPES })
  @IsIn(PRODUCT_TYPES)
  type: ProductType;

  /** Required to approve a candidate whose IP risk is `blocked`. */
  @IsOptional()
  @IsBoolean()
  acknowledgeIpRisk?: boolean;
}

export class AdminDesignCandidateListItemDto {
  id: string;
  @ApiProperty({ enum: STORES })
  store: Store;
  @ApiProperty({ enum: DESIGN_SOURCES })
  source: DesignSource;
  title: string;
  authorName: string;
  @ApiProperty({ enum: DESIGN_LICENSES })
  license: DesignLicense;
  previewUrl: string | null;
  likes: number;
  views: number;
  popularityScore: number;
  relevanceScore: number;
  @ApiProperty({ enum: PRODUCT_TYPES, nullable: true })
  suggestedType: ProductType | null;
  @ApiProperty({ enum: DESIGN_IP_RISKS })
  ipRisk: DesignIpRisk;
  @ApiProperty({ enum: DESIGN_STATUSES })
  status: DesignStatus;
  productId: string | null;
  sourcePublishedAt: Date | null;
}

export class AdminDesignCandidatePageDto {
  items: AdminDesignCandidateListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class AdminDesignCandidateDto extends AdminDesignCandidateListItemDto {
  sourceId: string;
  sourceUrl: string;
  description: string | null;
  tags: string[];
  authorUrl: string | null;
  licenseName: string;
  licenseUrl: string;
  attributionRequired: boolean;
  /** Our changes to the file must be shared under the same license. */
  shareAlike: boolean;
  /** `false`: the model may be scaled but not remixed. */
  derivativesAllowed: boolean;
  embedUrl: string | null;
  ipMatches: string[];
  reviewedBy: string | null;
  reviewedAt: Date | null;
  lastSyncedAt: Date;
  createdAt: Date;
}

export class DesignImportSkippedDto {
  license: number;
  not_downloadable: number;
  age_restricted: number;
  irrelevant: number;
}

export class DesignImportSourceSummaryDto {
  fetched: number;
  failedRequests: number;
}

export class DesignImportSourcesDto {
  sketchfab: DesignImportSourceSummaryDto;
  thingiverse: DesignImportSourceSummaryDto;
}

export class DesignImportStatusDto {
  running: boolean;
  enabled: boolean;
  /** Whether `THINGIVERSE_API_TOKEN` is set, so Thingiverse is imported. */
  thingiverseEnabled: boolean;
  /** Summary of the current or last run since the API started. */
  lastRun: DesignImportRunDto | null;
}

export class DesignImportRunDto {
  @ApiProperty({ enum: ['running', 'completed', 'failed'] })
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  finishedAt: Date | null;
  fetched: number;
  created: number;
  updated: number;
  skipped: DesignImportSkippedDto;
  failedRequests: number;
  /** Fetched models and failed requests per source. */
  sources: DesignImportSourcesDto;
  error: string | null;
}

/**
 * A model link pasted by staff. Sketchfab and Thingiverse are read from their
 * API; Printables and MyMiniFactory need `license`, and `title` and
 * `authorName` when the page cannot be read. The other fields override what
 * the page shows.
 */
export class ImportDesignUrlDto {
  @IsString()
  @MaxLength(500)
  url: string;

  @ApiProperty({ enum: STORES, required: false, default: 'gripr' })
  @IsOptional()
  @IsIn(STORES)
  store: Store = 'gripr';

  /** Required for Printables and MyMiniFactory; ignored for the others. */
  @ApiProperty({ enum: DESIGN_LICENSES, required: false })
  @IsOptional()
  @IsIn(DESIGN_LICENSES)
  license?: DesignLicense;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  authorName?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  authorUrl?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(1000)
  previewUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
