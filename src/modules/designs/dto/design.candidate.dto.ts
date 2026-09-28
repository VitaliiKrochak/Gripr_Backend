import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  DESIGN_IP_RISKS,
  DESIGN_LICENSES,
  DESIGN_SOURCES,
  DESIGN_STATUSES,
  PRODUCT_TYPES,
} from '../../../integrations/database/database.schema';
import type {
  DesignIpRisk,
  DesignLicense,
  DesignSource,
  DesignStatus,
  ProductType,
} from '../../../integrations/database/database.schema';
import { PaginationQueryDto } from '../../../shared/pagination/pagination.query.dto';

export const DESIGN_CANDIDATE_SORTS = ['score', 'likes', 'newest'] as const;
export type DesignCandidateSort = (typeof DESIGN_CANDIDATE_SORTS)[number];

export class DesignCandidateListQueryDto extends PaginationQueryDto {
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

export class DesignImportStatusDto {
  running: boolean;
  enabled: boolean;
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
  error: string | null;
}
