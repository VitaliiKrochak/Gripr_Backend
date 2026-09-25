import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { inArray, sql } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  designCandidates,
  type NewDesignCandidate,
} from '../../integrations/database/database.schema';
import { SKETCHFAB_CONFIG } from '../../integrations/sketchfab/sketchfab.config';
import type { SketchfabConfig } from '../../integrations/sketchfab/sketchfab.config';
import {
  SketchfabService,
  type SketchfabLicenseSlug,
  type SketchfabModel,
  type SketchfabSort,
} from '../../integrations/sketchfab/sketchfab.service';
import { assessIpRisk } from './design.ip';
import { classifyLicense, type LicenseRejection } from './design.license';
import { computePopularityScores } from './design.popularity';
import { MIN_RELEVANCE, scoreRelevance } from './design.relevance';

export const IMPORT_LICENSES: SketchfabLicenseSlug[] = ['cc0', 'by'];
export const IMPORT_QUERIES = [
  'ring',
  'pendant',
  'earrings',
  'necklace',
  'bracelet',
  'brooch',
  'charm',
  'jewelry',
  'jewellery',
];
export const IMPORT_SORTS: SketchfabSort[] = ['-likeCount', '-publishedAt'];
export const IMPORT_MAX_PAGES = 5;

export type ImportSkipReason = LicenseRejection | 'irrelevant';

export interface DesignImportSummary {
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  finishedAt: Date | null;
  fetched: number;
  created: number;
  updated: number;
  skipped: Record<ImportSkipReason, number>;
  failedRequests: number;
  error: string | null;
}

export class DesignImportInProgressError extends Error {}

/** Maps a Sketchfab model to a candidate row, or the reason it is skipped. */
export function toDesignCandidate(
  model: SketchfabModel,
  now: Date,
): NewDesignCandidate | ImportSkipReason {
  const license = classifyLicense(model);

  if (typeof license === 'string') return license;

  const relevance = scoreRelevance(model);

  if (relevance.score < MIN_RELEVANCE) return 'irrelevant';

  const ip = assessIpRisk(model);

  return {
    source: 'sketchfab',
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

const SCORE_BATCH = 500;

@Injectable()
export class DesignImportService {
  private readonly logger = new Logger(DesignImportService.name);
  private current: Promise<DesignImportSummary> | null = null;
  private last: DesignImportSummary | null = null;
  /** Pause between Sketchfab requests to stay well below rate limits. */
  requestDelayMs = 250;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(SKETCHFAB_CONFIG) private readonly config: SketchfabConfig,
    private readonly sketchfab: SketchfabService,
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
      error: null,
    };

    this.last = summary;
    this.current = this.execute(summary).finally(() => {
      this.current = null;
    });

    return this.current;
  }

  private async execute(
    summary: DesignImportSummary,
  ): Promise<DesignImportSummary> {
    try {
      const models = await this.fetchAll(summary);
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

  private async fetchAll(
    summary: DesignImportSummary,
  ): Promise<Map<string, SketchfabModel>> {
    const models = new Map<string, SketchfabModel>();

    for (const license of IMPORT_LICENSES) {
      for (const q of IMPORT_QUERIES) {
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

              summary.fetched += result.models.length;
              result.models.forEach((model) =>
                models.set(model.sourceId, model),
              );
              cursor = result.cursor;
            } catch (error) {
              summary.failedRequests += 1;
              this.logger.warn(
                `Sketchfab search failed (${license}/${q}/${sortBy}): ${String(error)}`,
              );
              break;
            }

            if (!cursor) break;
            await this.pause();
          }
        }
      }
    }

    return models;
  }

  private toCandidates(
    models: Map<string, SketchfabModel>,
    summary: DesignImportSummary,
  ): NewDesignCandidate[] {
    const rows: NewDesignCandidate[] = [];
    const now = new Date();

    for (const model of models.values()) {
      const row = toDesignCandidate(model, now);

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
    for (let index = 0; index < rows.length; index += SCORE_BATCH) {
      const batch = rows.slice(index, index + SCORE_BATCH);
      const existing = await this.db
        .select({ sourceId: designCandidates.sourceId })
        .from(designCandidates)
        .where(
          inArray(
            designCandidates.sourceId,
            batch.map((row) => row.sourceId),
          ),
        );
      const known = new Set(existing.map((row) => row.sourceId));

      await this.db
        .insert(designCandidates)
        .values(batch)
        .onConflictDoUpdate({
          target: [designCandidates.source, designCandidates.sourceId],
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

      summary.updated += batch.filter((row) => known.has(row.sourceId)).length;
      summary.created += batch.filter((row) => !known.has(row.sourceId)).length;
    }
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

  private pause(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.requestDelayMs));
  }
}
