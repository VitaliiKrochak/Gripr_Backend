import { Inject, Injectable } from '@nestjs/common';
import { SKETCHFAB_CONFIG } from './sketchfab.config';
import type { SketchfabConfig } from './sketchfab.config';

/** Sketchfab search license slugs. */
export type SketchfabLicenseSlug = 'cc0' | 'by';

export type SketchfabSort = '-likeCount' | '-publishedAt';

interface ApiThumbnail {
  url: string;
  width: number;
  height: number;
}

interface ApiModel {
  uid: string;
  name: string;
  description?: string | null;
  tags?: { name: string }[];
  likeCount?: number;
  viewCount?: number;
  publishedAt?: string | null;
  isDownloadable?: boolean;
  isAgeRestricted?: boolean;
  viewerUrl: string;
  embedUrl?: string | null;
  license?: { label?: string | null } | null;
  user?: { displayName?: string; username?: string; profileUrl?: string };
  thumbnails?: { images?: ApiThumbnail[] };
}

interface ApiSearchResponse {
  results: ApiModel[];
  next: string | null;
}

export interface SketchfabModel {
  sourceId: string;
  title: string;
  description: string | null;
  tags: string[];
  likes: number;
  views: number;
  publishedAt: Date | null;
  isDownloadable: boolean;
  isAgeRestricted: boolean;
  licenseLabel: string | null;
  author: string;
  authorUrl: string | null;
  previewUrl: string | null;
  embedUrl: string | null;
  sourceUrl: string;
}

export interface SketchfabSearchPage {
  models: SketchfabModel[];
  /** Opaque cursor for the next page, `null` on the last page. */
  cursor: string | null;
}

export interface SketchfabSearchQuery {
  q: string;
  license: SketchfabLicenseSlug;
  sortBy: SketchfabSort;
  cursor?: string | null;
  count?: number;
}

export class SketchfabError extends Error {}

const PREVIEW_WIDTH = 1024;

@Injectable()
export class SketchfabService {
  constructor(
    @Inject(SKETCHFAB_CONFIG) private readonly config: SketchfabConfig,
  ) {}

  /** Downloadable models matching `q` under one license. */
  async searchModels(
    query: SketchfabSearchQuery,
  ): Promise<SketchfabSearchPage> {
    const params = new URLSearchParams({
      type: 'models',
      q: query.q,
      license: query.license,
      downloadable: 'true',
      sort_by: query.sortBy,
      count: String(query.count ?? 24),
    });

    if (query.cursor) params.set('cursor', query.cursor);

    const response = await fetch(`${this.config.baseUrl}/search?${params}`, {
      headers: this.config.apiToken
        ? { Authorization: `Token ${this.config.apiToken}` }
        : undefined,
    });

    if (!response.ok) {
      throw new SketchfabError(`Sketchfab responded with ${response.status}`);
    }

    const payload = (await response.json()) as ApiSearchResponse;

    return {
      models: payload.results.map(toModel),
      cursor: payload.next
        ? new URL(payload.next).searchParams.get('cursor')
        : null,
    };
  }
}

function toModel(model: ApiModel): SketchfabModel {
  const published = model.publishedAt ? new Date(model.publishedAt) : null;

  return {
    sourceId: model.uid,
    title: model.name.trim(),
    description: model.description?.trim() || null,
    tags: (model.tags ?? []).map((tag) => tag.name),
    likes: model.likeCount ?? 0,
    views: model.viewCount ?? 0,
    publishedAt:
      published && !Number.isNaN(published.getTime()) ? published : null,
    isDownloadable: model.isDownloadable ?? false,
    isAgeRestricted: model.isAgeRestricted ?? false,
    licenseLabel: model.license?.label ?? null,
    author: model.user?.displayName || model.user?.username || 'Unknown',
    authorUrl: model.user?.profileUrl ?? null,
    previewUrl: pickPreview(model.thumbnails?.images ?? []),
    embedUrl: model.embedUrl ?? null,
    sourceUrl: model.viewerUrl,
  };
}

/** Smallest thumbnail at least `PREVIEW_WIDTH` wide, else the largest. */
function pickPreview(images: ApiThumbnail[]): string | null {
  const sorted = [...images].sort((a, b) => a.width - b.width);

  return (
    sorted.find((image) => image.width >= PREVIEW_WIDTH)?.url ??
    sorted.at(-1)?.url ??
    null
  );
}
