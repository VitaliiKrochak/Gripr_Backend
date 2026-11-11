import { Inject, Injectable } from '@nestjs/common';
import { THINGIVERSE_CONFIG } from './thingiverse.config';
import type { ThingiverseConfig } from './thingiverse.config';

/** Thingiverse search license codes of licenses that allow selling prints. */
export type ThingiverseLicenseCode = 'cc' | 'cc-sa' | 'cc-nd' | 'pd0';

export type ThingiverseSort = 'popular' | 'newest';

interface ApiCreator {
  name?: string;
  public_url?: string;
}

interface ApiHit {
  id: number;
  name: string;
  like_count?: number;
}

interface ApiSearchResponse {
  total?: number;
  hits?: ApiHit[] | null;
}

interface ApiImageSize {
  type?: string;
  size?: string;
  url?: string;
}

interface ApiThing {
  id: number;
  name: string;
  description?: string | null;
  public_url: string;
  license?: string | null;
  like_count?: number;
  view_count?: number;
  added?: string | null;
  is_nsfw?: boolean;
  is_ai?: boolean;
  creator?: ApiCreator | null;
  tags?: { name: string }[];
  thumbnail?: string | null;
  default_image?: { url?: string; sizes?: ApiImageSize[] } | null;
}

export interface ThingiverseHit {
  id: string;
  likes: number;
}

/** A thing in the shape the design importer shares with Sketchfab. */
export interface ThingiverseModel {
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

export interface ThingiverseSearchQuery {
  q: string;
  license: ThingiverseLicenseCode;
  sort: ThingiverseSort;
  page: number;
  perPage?: number;
}

export class ThingiverseError extends Error {}

@Injectable()
export class ThingiverseService {
  constructor(
    @Inject(THINGIVERSE_CONFIG) private readonly config: ThingiverseConfig,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.apiToken);
  }

  /** Thing ids matching `q` under one license, without AI-made designs. */
  async search(query: ThingiverseSearchQuery): Promise<ThingiverseHit[]> {
    const params = new URLSearchParams({
      type: 'things',
      license: query.license,
      sort: query.sort,
      page: String(query.page),
      per_page: String(query.perPage ?? 30),
      show_ai: 'false',
    });
    const payload = await this.request<ApiSearchResponse>(
      `/search/${encodeURIComponent(query.q)}?${params}`,
    );

    return (payload.hits ?? []).map((hit) => ({
      id: String(hit.id),
      likes: hit.like_count ?? 0,
    }));
  }

  /** Full details, including the license, of one thing. */
  async getThing(id: string): Promise<ThingiverseModel> {
    return toModel(
      await this.request<ApiThing>(`/things/${encodeURIComponent(id)}`),
    );
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.config.apiToken) {
      throw new ThingiverseError('THINGIVERSE_API_TOKEN is not set');
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.config.apiToken}` },
    });

    if (!response.ok) {
      throw new ThingiverseError(
        `Thingiverse responded with ${response.status}`,
      );
    }

    return (await response.json()) as T;
  }
}

function toModel(thing: ApiThing): ThingiverseModel {
  const added = thing.added ? new Date(thing.added) : null;

  return {
    sourceId: String(thing.id),
    title: thing.name.trim(),
    description: thing.description?.trim() || null,
    tags: (thing.tags ?? []).map((tag) => tag.name),
    likes: thing.like_count ?? 0,
    views: thing.view_count ?? 0,
    publishedAt: added && !Number.isNaN(added.getTime()) ? added : null,
    isDownloadable: true,
    isAgeRestricted: thing.is_nsfw ?? false,
    licenseLabel: thing.license ?? null,
    author: thing.creator?.name || 'Unknown',
    authorUrl: thing.creator?.public_url ?? null,
    previewUrl: pickPreview(thing),
    embedUrl: null,
    sourceUrl: thing.public_url,
  };
}

/** The large display image, else any image, else the thumbnail. */
function pickPreview(thing: ApiThing): string | null {
  const sizes = thing.default_image?.sizes ?? [];

  return (
    sizes.find((size) => size.type === 'display' && size.size === 'large')
      ?.url ??
    thing.default_image?.url ??
    thing.thumbnail ??
    null
  );
}
