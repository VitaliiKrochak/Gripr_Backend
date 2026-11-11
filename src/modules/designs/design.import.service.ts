import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  designCandidates,
  type DesignCandidate,
  type DesignSource,
  type NewDesignCandidate,
  type Store,
} from '../../integrations/database/database.schema';
import { SKETCHFAB_CONFIG } from '../../integrations/sketchfab/sketchfab.config';
import type { SketchfabConfig } from '../../integrations/sketchfab/sketchfab.config';
import {
  SketchfabService,
  type SketchfabLicenseSlug,
  type SketchfabModel,
  type SketchfabSort,
} from '../../integrations/sketchfab/sketchfab.service';
import {
  ThingiverseService,
  type ThingiverseLicenseCode,
} from '../../integrations/thingiverse/thingiverse.service';
import { assessIpRisk } from './design.ip';
import {
  classifyLicense,
  DESIGN_LICENSE_INFO,
  STORE_LICENSES,
  type LicenseRejection,
} from './design.license';
import { computePopularityScores } from './design.popularity';
import { MIN_RELEVANCE, scoreRelevance } from './design.relevance';
import { PAGE_SOURCES, parseDesignUrl, readPageMetadata } from './design.url';
import type { DesignUrlReference } from './design.url';
import type { ImportDesignUrlDto } from './dto/design.candidate.dto';

export const IMPORT_LICENSES: SketchfabLicenseSlug[] = ['cc0', 'by'];
export const IMPORT_QUERIES: Record<Store, string[]> = {
  gripr: [
    'ring',
    'pendant',
    'earrings',
    'necklace',
    'bracelet',
    'brooch',
    'charm',
    'jewelry',
    'jewellery',
  ],
  lab: [
    'miniature',
    'figurine',
    'bust',
    'statue',
    'tabletop',
    'dragon',
    'terrain',
    'diorama',
    '3d print',
    'printable',
  ],
};
export const IMPORT_SORTS: SketchfabSort[] = ['-likeCount', '-publishedAt'];
export const IMPORT_MAX_PAGES = 5;

export const THINGIVERSE_LICENSES: ThingiverseLicenseCode[] = [
  'pd0',
  'cc',
  'cc-sa',
  'cc-nd',
];
export const THINGIVERSE_MAX_PAGES = 2;
/** Thing details read per run; the rest wait for the next night. */
export const THINGIVERSE_DETAIL_LIMIT = 150;

const NO_DERIVATIVES_MATCH = 'license: no derivatives';

export type ImportSkipReason = LicenseRejection | 'irrelevant';
export type ImportedSource = Extract<DesignSource, 'sketchfab' | 'thingiverse'>;

export interface DesignImportSourceSummary {
  fetched: number;
  failedRequests: number;
}

export interface DesignImportSummary {
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  finishedAt: Date | null;
  fetched: number;
  created: number;
  updated: number;
  skipped: Record<ImportSkipReason, number>;
  failedRequests: number;
  sources: Record<ImportedSource, DesignImportSourceSummary>;
  error: string | null;
}

/** A model of any source, normalized like the Sketchfab search results. */
export type DesignSourceModel = SketchfabModel & { source: DesignSource };

export class DesignImportInProgressError extends Error {}

/**
 * Maps a model to a candidate row of the store, or the reason it is skipped.
 * Staff imports by URL skip the relevance threshold.
 */
export function toDesignCandidate(
  model: DesignSourceModel,
  store: Store,
  now: Date,
  { requireRelevance = true }: { requireRelevance?: boolean } = {},
): NewDesignCandidate | ImportSkipReason {
  const license = classifyLicense(model, STORE_LICENSES[store]);

  if (typeof license === 'string') return license;

  const relevance = scoreRelevance(model, store);

  if (requireRelevance && relevance.score < MIN_RELEVANCE) return 'irrelevant';

  const ip = assessIpRisk(model, store);

  if (!license.derivativesAllowed) {
    ip.matches = [...ip.matches, NO_DERIVATIVES_MATCH];
    if (ip.risk === 'low') ip.risk = 'review';
  }

  return {
    store,
    source: model.source,
    sourceId: model.sourceId,
    sourceUrl: model.sourceUrl,
    title: model.title,
    description: model.description,
    tags: model.tags,
    authorName: model.author,
    authorUrl: model.authorUrl,
    license: license.license,
    licenseUrl: license.url,
    previewUrl: model.previewUrl,
    embedUrl: model.embedUrl,
    likes: model.likes,
    views: model.views,
    sourcePublishedAt: model.publishedAt,
    suggestedType: relevance.suggestedType,
    relevanceScore: relevance.score,
    ipRisk: ip.risk,
    ipMatches: ip.matches,
    lastSyncedAt: now,
  };
}

const URL_REJECTIONS: Record<LicenseRejection, string> = {
  license: 'The license does not allow selling prints of this model here',
  not_downloadable: 'The model cannot be downloaded',
  age_restricted: 'Age-restricted models are not imported',
};

const SCORE_BATCH = 500;
const PAGE_TIMEOUT_MS = 10_000;
const PAGE_MAX_CHARS = 2_000_000;

type Collected = Map<string, { store: Store; model: DesignSourceModel }>;

@Injectable()
export class DesignImportService {
  private readonly logger = new Logger(DesignImportService.name);
  private current: Promise<DesignImportSummary> | null = null;
  private last: DesignImportSummary | null = null;
  /** Pause between Sketchfab requests to stay well below rate limits. */
  requestDelayMs = 250;
  /** Thingiverse allows about one request per second. */
  thingiverseDelayMs = 1000;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(SKETCHFAB_CONFIG) private readonly config: SketchfabConfig,
    private readonly sketchfab: SketchfabService,
    private readonly thingiverse: ThingiverseService,
  ) {}

  get lastRun(): DesignImportSummary | null {
    return this.last;
  }

  get isRunning(): boolean {
    return this.current !== null;
  }

  get isEnabled(): boolean {
    return this.config.importEnabled;
  }

  get isThingiverseEnabled(): boolean {
    return this.thingiverse.isConfigured();
  }

  @Cron('0 2 * * *', { name: 'design-import', timeZone: 'Europe/Kyiv' })
  async runNightly(): Promise<void> {
    if (!this.config.importEnabled || this.isRunning) return;

    await this.run();
  }

  /** Starts an import; throws when one is already running. */
  start(): DesignImportSummary {
    if (this.isRunning) throw new DesignImportInProgressError();

    void this.run();

    return this.last!;
  }

  async run(): Promise<DesignImportSummary> {
    if (this.current) throw new DesignImportInProgressError();

    const summary: DesignImportSummary = {
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: {
        license: 0,
        not_downloadable: 0,
        age_restricted: 0,
        irrelevant: 0,
      },
      failedRequests: 0,
      sources: {
        sketchfab: { fetched: 0, failedRequests: 0 },
        thingiverse: { fetched: 0, failedRequests: 0 },
      },
      error: null,
    };

    this.last = summary;
    this.current = this.execute(summary).finally(() => {
      this.current = null;
    });

    return this.current;
  }

  /**
   * Staff paste a model link. Sketchfab and Thingiverse models are read from
   * their API; Printables and MyMiniFactory pages only give the title,
   * picture, and author, so staff enter the license (and what is missing).
   */
  async importUrl(
    dto: ImportDesignUrlDto,
  ): Promise<{ candidate: DesignCandidate; created: boolean }> {
    const reference = parseDesignUrl(dto.url);

    if (!reference) {
      throw new BadRequestException(
        'Paste a Sketchfab, Thingiverse, Printables, or MyMiniFactory model link',
      );
    }

    const store = dto.store;
    const model = PAGE_SOURCES.includes(reference.source)
      ? await this.pageModel(reference, dto, store)
      : await this.apiModel(reference);
    const row = toDesignCandidate(model, store, new Date(), {
      requireRelevance: false,
    });

    if (typeof row === 'string') {
      throw new BadRequestException(URL_REJECTIONS[row]);
    }

    const [existing] = await this.db
      .select({ id: designCandidates.id })
      .from(designCandidates)
      .where(
        and(
          eq(designCandidates.store, store),
          eq(designCandidates.source, row.source),
          eq(designCandidates.sourceId, row.sourceId),
        ),
      );

    await this.insertOrRefresh([row]);
    await this.recomputeScores();
    const [candidate] = await this.db
      .select()
      .from(designCandidates)
      .where(
        and(
          eq(designCandidates.store, store),
          eq(designCandidates.source, row.source),
          eq(designCandidates.sourceId, row.sourceId),
        ),
      );

    return { candidate, created: !existing };
  }

  private async apiModel(
    reference: DesignUrlReference,
  ): Promise<DesignSourceModel> {
    if (reference.source === 'thingiverse' && !this.isThingiverseEnabled) {
      throw new ServiceUnavailableException(
        'Thingiverse imports need THINGIVERSE_API_TOKEN',
      );
    }

    try {
      const model =
        reference.source === 'thingiverse'
          ? await this.thingiverse.getThing(reference.sourceId)
          : await this.sketchfab.getModel(reference.sourceId);
      return { ...model, source: reference.source };
    } catch (error) {
      this.logger.warn(`Reading ${reference.url} failed: ${String(error)}`);
      throw new BadGatewayException(
        'The model could not be read from its source',
      );
    }
  }

  private async pageModel(
    reference: DesignUrlReference,
    dto: ImportDesignUrlDto,
    store: Store,
  ): Promise<DesignSourceModel> {
    if (!dto.license) {
      throw new BadRequestException(
        'Choose the license shown on the model page',
      );
    }

    if (!STORE_LICENSES[store].includes(dto.license)) {
      throw new BadRequestException(URL_REJECTIONS.license);
    }

    const page = await this.readPage(reference);
    const title = dto.title?.trim() || page?.title;
    const author = dto.authorName?.trim() || page?.author;

    if (!title || !author) {
      throw new BadRequestException(
        'The page could not be read; enter the title and the author',
      );
    }

    return {
      source: reference.source,
      sourceId: reference.sourceId,
      title,
      description: dto.description?.trim() || page?.description || null,
      tags: [],
      likes: 0,
      views: 0,
      publishedAt: null,
      isDownloadable: true,
      isAgeRestricted: false,
      licenseLabel: DESIGN_LICENSE_INFO[dto.license].name,
      author,
      authorUrl: dto.authorUrl ?? null,
      previewUrl: dto.previewUrl ?? page?.image ?? null,
      embedUrl: null,
      sourceUrl: reference.url,
    };
  }

  /** Metadata of an allowed model page, or `null` when it cannot be read. */
  private async readPage(reference: DesignUrlReference) {
    try {
      const response = await fetch(reference.url, {
        headers: { Accept: 'text/html', 'User-Agent': 'GriprDesignImport/1.0' },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
      const landed = parseDesignUrl(response.url || reference.url);

      if (!response.ok || landed?.source !== reference.source) return null;

      return readPageMetadata((await response.text()).slice(0, PAGE_MAX_CHARS));
    } catch (error) {
      this.logger.warn(`Reading ${reference.url} failed: ${String(error)}`);
      return null;
    }
  }

  private async execute(
    summary: DesignImportSummary,
  ): Promise<DesignImportSummary> {
    try {
      const models: Collected = new Map();

      for (const store of ['gripr', 'lab'] as const) {
        await this.fetchSketchfab(store, summary, models);
      }
      await this.fetchThingiverse(summary, models);

      const rows = this.toCandidates(models, summary);

      await this.upsert(rows, summary);
      await this.recomputeScores();
      summary.status = 'completed';
    } catch (error) {
      summary.status = 'failed';
      summary.error = error instanceof Error ? error.message : String(error);
      this.logger.error('Design import failed', error);
    } finally {
      summary.finishedAt = new Date();
    }

    this.logger.log(
      `Design import ${summary.status}: ${summary.created} new, ${summary.updated} updated, ${summary.fetched} fetched`,
    );

    return summary;
  }

  private async fetchSketchfab(
    store: Store,
    summary: DesignImportSummary,
    models: Collected,
  ): Promise<void> {
    for (const license of IMPORT_LICENSES) {
      for (const q of IMPORT_QUERIES[store]) {
        for (const sortBy of IMPORT_SORTS) {
          let cursor: string | null = null;

          for (let page = 0; page < IMPORT_MAX_PAGES; page += 1) {
            try {
              const result = await this.sketchfab.searchModels({
                q,
                license,
                sortBy,
                cursor,
              });

              this.count(summary, 'sketchfab', result.models.length);
              result.models.forEach((model) =>
                models.set(`${store}:sketchfab:${model.sourceId}`, {
                  store,
                  model: { ...model, source: 'sketchfab' },
                }),
              );
              cursor = result.cursor;
            } catch (error) {
              this.fail(summary, 'sketchfab');
              this.logger.warn(
                `Sketchfab search failed (${store}/${license}/${q}/${sortBy}): ${String(error)}`,
              );
              break;
            }

            if (!cursor) break;
            await this.pause(this.requestDelayMs);
          }
        }
      }
    }
  }

  /**
   * Gripr Lab models from Thingiverse: searches every license and query,
   * then reads the details (and the license again) of new things first,
   * then of known ones synced longest ago, up to the per-run limit.
   */
  private async fetchThingiverse(
    summary: DesignImportSummary,
    models: Collected,
  ): Promise<void> {
    if (!this.isThingiverseEnabled) return;

    const likes = new Map<string, number>();

    for (const license of THINGIVERSE_LICENSES) {
      for (const q of IMPORT_QUERIES.lab) {
        for (let page = 1; page <= THINGIVERSE_MAX_PAGES; page += 1) {
          try {
            const hits = await this.thingiverse.search({
              q,
              license,
              sort: 'popular',
              page,
            });

            hits.forEach((hit) => likes.set(hit.id, hit.likes));
            await this.pause(this.thingiverseDelayMs);
            if (hits.length < 30) break;
          } catch (error) {
            this.fail(summary, 'thingiverse');
            this.logger.warn(
              `Thingiverse search failed (${license}/${q}): ${String(error)}`,
            );
            break;
          }
        }
      }
    }

    const ids = [...likes.keys()];
    const synced = new Map<string, number>();

    for (let index = 0; index < ids.length; index += SCORE_BATCH) {
      const rows = await this.db
        .select({
          sourceId: designCandidates.sourceId,
          lastSyncedAt: designCandidates.lastSyncedAt,
        })
        .from(designCandidates)
        .where(
          and(
            eq(designCandidates.store, 'lab'),
            eq(designCandidates.source, 'thingiverse'),
            inArray(
              designCandidates.sourceId,
              ids.slice(index, index + SCORE_BATCH),
            ),
          ),
        );
      rows.forEach((row) =>
        synced.set(row.sourceId, row.lastSyncedAt.getTime()),
      );
    }

    const queue = ids
      .sort((a, b) => {
        const known = Number(synced.has(a)) - Number(synced.has(b));
        if (known !== 0) return known;
        return synced.has(a)
          ? synced.get(a)! - synced.get(b)!
          : likes.get(b)! - likes.get(a)!;
      })
      .slice(0, THINGIVERSE_DETAIL_LIMIT);

    for (const id of queue) {
      try {
        const thing = await this.thingiverse.getThing(id);

        this.count(summary, 'thingiverse', 1);
        models.set(`lab:thingiverse:${id}`, {
          store: 'lab',
          model: { ...thing, source: 'thingiverse' },
        });
      } catch (error) {
        this.fail(summary, 'thingiverse');
        this.logger.warn(`Thingiverse thing ${id} failed: ${String(error)}`);
      }

      await this.pause(this.thingiverseDelayMs);
    }
  }

  private toCandidates(
    models: Collected,
    summary: DesignImportSummary,
  ): NewDesignCandidate[] {
    const rows: NewDesignCandidate[] = [];
    const now = new Date();

    for (const { store, model } of models.values()) {
      const row = toDesignCandidate(model, store, now);

      if (typeof row === 'string') {
        summary.skipped[row] += 1;
      } else {
        rows.push(row);
      }
    }

    return rows;
  }

  /** Refreshes metadata and stats; review state is never touched. */
  private async upsert(
    rows: NewDesignCandidate[],
    summary: DesignImportSummary,
  ): Promise<void> {
    const groups = new Map<string, NewDesignCandidate[]>();

    for (const row of rows) {
      const key = `${row.store}:${row.source}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    for (const group of groups.values()) {
      const { store, source } = group[0];

      for (let index = 0; index < group.length; index += SCORE_BATCH) {
        const batch = group.slice(index, index + SCORE_BATCH);
        const existing = await this.db
          .select({ sourceId: designCandidates.sourceId })
          .from(designCandidates)
          .where(
            and(
              eq(designCandidates.store, store!),
              eq(designCandidates.source, source),
              inArray(
                designCandidates.sourceId,
                batch.map((row) => row.sourceId),
              ),
            ),
          );
        const known = new Set(existing.map((row) => row.sourceId));

        await this.insertOrRefresh(batch);

        summary.updated += batch.filter((row) =>
          known.has(row.sourceId),
        ).length;
        summary.created += batch.filter(
          (row) => !known.has(row.sourceId),
        ).length;
      }
    }
  }

  private async insertOrRefresh(rows: NewDesignCandidate[]): Promise<void> {
    await this.db
      .insert(designCandidates)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          designCandidates.store,
          designCandidates.source,
          designCandidates.sourceId,
        ],
        set: {
          sourceUrl: sql`excluded.source_url`,
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          tags: sql`excluded.tags`,
          authorName: sql`excluded.author_name`,
          authorUrl: sql`excluded.author_url`,
          license: sql`excluded.license`,
          licenseUrl: sql`excluded.license_url`,
          previewUrl: sql`excluded.preview_url`,
          embedUrl: sql`excluded.embed_url`,
          likes: sql`excluded.likes`,
          views: sql`excluded.views`,
          sourcePublishedAt: sql`excluded.source_published_at`,
          suggestedType: sql`excluded.suggested_type`,
          relevanceScore: sql`excluded.relevance_score`,
          ipRisk: sql`excluded.ip_risk`,
          ipMatches: sql`excluded.ip_matches`,
          lastSyncedAt: sql`excluded.last_synced_at`,
          updatedAt: sql`now()`,
        },
      });
  }

  async recomputeScores(): Promise<void> {
    const rows = await this.db
      .select({
        id: designCandidates.id,
        type: designCandidates.suggestedType,
        likes: designCandidates.likes,
        views: designCandidates.views,
        publishedAt: designCandidates.sourcePublishedAt,
        score: designCandidates.popularityScore,
      })
      .from(designCandidates);
    const scores = computePopularityScores(
      rows.map((row) => ({
        id: row.id,
        group: row.type ?? 'other',
        likes: row.likes,
        views: row.views,
        publishedAt: row.publishedAt,
      })),
    );
    const changed = rows
      .map((row) => ({ id: row.id, score: scores.get(row.id) ?? 0 }))
      .filter((row, index) => row.score !== rows[index].score);

    for (let index = 0; index < changed.length; index += SCORE_BATCH) {
      const values = sql.join(
        changed
          .slice(index, index + SCORE_BATCH)
          .map((row) => sql`(${row.id}::uuid, ${row.score}::integer)`),
        sql`, `,
      );

      await this.db.execute(
        sql`update ${designCandidates} set popularity_score = scores.score from (values ${values}) as scores(id, score) where ${designCandidates.id} = scores.id`,
      );
    }
  }

  private count(
    summary: DesignImportSummary,
    source: ImportedSource,
    fetched: number,
  ): void {
    summary.fetched += fetched;
    summary.sources[source].fetched += fetched;
  }

  private fail(summary: DesignImportSummary, source: ImportedSource): void {
    summary.failedRequests += 1;
    summary.sources[source].failedRequests += 1;
  }

  private pause(ms: number): Promise<void> {
    return ms > 0
      ? new Promise((resolve) => setTimeout(resolve, ms))
      : Promise.resolve();
  }
}
