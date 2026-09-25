import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { and, count, desc, eq, ilike, isNull, ne, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  designCandidates,
  type DesignCandidate,
  type DesignStatus,
} from '../../integrations/database/database.schema';
import { toOffset, toPage } from '../../shared/pagination/pagination';
import { ProductImagesService } from '../catalog/product.images.service';
import { ProductsService } from '../catalog/products.service';
import type { AdminProductDto } from '../catalog/dto/product.dto';
import { DESIGN_LICENSE_INFO } from './design.license';
import { designSlug } from './design.slug';
import type {
  AdminDesignCandidateDto,
  AdminDesignCandidatePageDto,
  ApproveDesignCandidateDto,
  DesignCandidateListQueryDto,
} from './dto/design.candidate.dto';

const PRODUCT_NAME_MAX = 150;

@Injectable()
export class DesignCandidatesService {
  private readonly logger = new Logger(DesignCandidatesService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly productsService: ProductsService,
    private readonly imagesService: ProductImagesService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async list(
    query: DesignCandidateListQueryDto,
  ): Promise<AdminDesignCandidatePageDto> {
    const conditions: SQL[] = [eq(designCandidates.status, query.status)];

    if (query.type) {
      conditions.push(eq(designCandidates.suggestedType, query.type));
    }
    if (query.license) {
      conditions.push(eq(designCandidates.license, query.license));
    }
    conditions.push(
      query.ipRisk
        ? eq(designCandidates.ipRisk, query.ipRisk)
        : ne(designCandidates.ipRisk, 'blocked'),
    );
    if (query.q) {
      const pattern = `%${query.q.trim()}%`;
      conditions.push(
        or(
          ilike(designCandidates.title, pattern),
          ilike(designCandidates.authorName, pattern),
          sql`${designCandidates.tags}::text ilike ${pattern}`,
        )!,
      );
    }

    const where = and(...conditions);
    const orderBy = {
      score: [
        desc(designCandidates.popularityScore),
        desc(designCandidates.likes),
      ],
      likes: [desc(designCandidates.likes)],
      newest: [sql`${designCandidates.sourcePublishedAt} desc nulls last`],
    }[query.sort];
    const [items, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: designCandidates.id,
          source: designCandidates.source,
          title: designCandidates.title,
          authorName: designCandidates.authorName,
          license: designCandidates.license,
          previewUrl: designCandidates.previewUrl,
          likes: designCandidates.likes,
          views: designCandidates.views,
          popularityScore: designCandidates.popularityScore,
          relevanceScore: designCandidates.relevanceScore,
          suggestedType: designCandidates.suggestedType,
          ipRisk: designCandidates.ipRisk,
          status: designCandidates.status,
          productId: designCandidates.productId,
          sourcePublishedAt: designCandidates.sourcePublishedAt,
        })
        .from(designCandidates)
        .where(where)
        .orderBy(...orderBy, desc(designCandidates.id))
        .limit(query.pageSize)
        .offset(toOffset(query)),
      this.db.select({ total: count() }).from(designCandidates).where(where),
    ]);

    return toPage(items, total, query);
  }

  async get(id: string): Promise<AdminDesignCandidateDto> {
    return toAdminDto(await this.find(id));
  }

  /**
   * Turns the candidate into a draft product with the preview as its first
   * photo; staff then set price and options in the product editor.
   */
  async approve(
    id: string,
    dto: ApproveDesignCandidateDto,
    user: User,
  ): Promise<AdminProductDto> {
    const candidate = await this.find(id);

    if (candidate.status !== 'candidate') {
      throw new ConflictException('Only new candidates can be approved');
    }
    if (candidate.ipRisk === 'blocked' && !dto.acknowledgeIpRisk) {
      throw new ConflictException(
        'This design matches protected brands or franchises; confirm the IP risk to approve it',
      );
    }

    const product = await this.productsService.create({
      slug: designSlug(candidate.title, candidate.sourceId),
      name: candidate.title.slice(0, PRODUCT_NAME_MAX),
      type: dto.type,
      status: 'draft',
      basePrice: 0,
    });
    const [linked] = await this.db
      .update(designCandidates)
      .set({
        status: 'approved',
        productId: product.id,
        reviewedBy: user.id,
        reviewedAt: new Date(),
      })
      .where(
        and(
          eq(designCandidates.id, id),
          eq(designCandidates.status, 'candidate'),
        ),
      )
      .returning({ id: designCandidates.id });

    if (!linked) {
      await this.productsService.delete(product.id);
      throw new ConflictException('Only new candidates can be approved');
    }

    await this.attachPreview(product.id, candidate);

    return this.productsService.get(product.id);
  }

  async reject(id: string, user: User): Promise<AdminDesignCandidateDto> {
    return this.transition(id, user, 'rejected', [
      eq(designCandidates.status, 'candidate'),
    ]);
  }

  /** Back to the queue: rejected ones, or approved ones whose product was deleted. */
  async restore(id: string, user: User): Promise<AdminDesignCandidateDto> {
    return this.transition(id, user, 'candidate', [
      or(
        eq(designCandidates.status, 'rejected'),
        and(
          eq(designCandidates.status, 'approved'),
          isNull(designCandidates.productId),
        ),
      )!,
    ]);
  }

  private async transition(
    id: string,
    user: User,
    status: DesignStatus,
    allowedFrom: SQL[],
  ): Promise<AdminDesignCandidateDto> {
    await this.find(id);

    const [row] = await this.db
      .update(designCandidates)
      .set({ status, reviewedBy: user.id, reviewedAt: new Date() })
      .where(and(eq(designCandidates.id, id), ...allowedFrom))
      .returning();

    if (!row) {
      throw new ConflictException(`The candidate cannot move to ${status}`);
    }

    return toAdminDto(row);
  }

  private async attachPreview(
    productId: string,
    candidate: DesignCandidate,
  ): Promise<void> {
    if (!candidate.previewUrl) return;

    try {
      const asset = await this.cloudinary.uploadFromUrl(
        candidate.previewUrl,
        this.cloudinary.folder('products'),
      );

      await this.imagesService.add(productId, {
        ...asset,
        alt: candidate.title.slice(0, 255),
      });
    } catch (error) {
      this.logger.warn(
        `Preview copy failed for design ${candidate.id}: ${String(error)}`,
      );
    }
  }

  private async find(id: string): Promise<DesignCandidate> {
    const [candidate] = await this.db
      .select()
      .from(designCandidates)
      .where(eq(designCandidates.id, id));

    if (!candidate) {
      throw new NotFoundException('Design candidate not found');
    }

    return candidate;
  }
}

function toAdminDto(candidate: DesignCandidate): AdminDesignCandidateDto {
  const license = DESIGN_LICENSE_INFO[candidate.license];

  return {
    id: candidate.id,
    source: candidate.source,
    sourceId: candidate.sourceId,
    sourceUrl: candidate.sourceUrl,
    title: candidate.title,
    description: candidate.description,
    tags: candidate.tags,
    authorName: candidate.authorName,
    authorUrl: candidate.authorUrl,
    license: candidate.license,
    licenseName: license.name,
    licenseUrl: license.url,
    attributionRequired: license.attributionRequired,
    previewUrl: candidate.previewUrl,
    embedUrl: candidate.embedUrl,
    likes: candidate.likes,
    views: candidate.views,
    popularityScore: candidate.popularityScore,
    relevanceScore: candidate.relevanceScore,
    suggestedType: candidate.suggestedType,
    ipRisk: candidate.ipRisk,
    ipMatches: candidate.ipMatches,
    status: candidate.status,
    productId: candidate.productId,
    sourcePublishedAt: candidate.sourcePublishedAt,
    reviewedBy: candidate.reviewedBy,
    reviewedAt: candidate.reviewedAt,
    lastSyncedAt: candidate.lastSyncedAt,
    createdAt: candidate.createdAt,
  };
}
