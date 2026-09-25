import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  optionGroups,
  optionValues,
  productImages,
  products,
} from '../../integrations/database/database.schema';
import type {
  CreateProductImageDto,
  ProductImageDto,
  UpdateProductImageDto,
} from './dto/product.dto';

@Injectable()
export class ProductImagesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async add(
    productId: string,
    dto: CreateProductImageDto,
  ): Promise<ProductImageDto> {
    await this.assertProduct(productId);
    await this.assertOptionValue(productId, dto.optionValueId);

    const [image] = await this.db
      .insert(productImages)
      .values({ ...dto, productId })
      .returning();
    return image;
  }

  async update(
    productId: string,
    imageId: string,
    dto: UpdateProductImageDto,
  ): Promise<ProductImageDto> {
    await this.assertOptionValue(productId, dto.optionValueId);

    const [image] = await this.db
      .update(productImages)
      .set(dto)
      .where(
        and(
          eq(productImages.id, imageId),
          eq(productImages.productId, productId),
        ),
      )
      .returning();

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    return image;
  }

  async delete(productId: string, imageId: string): Promise<void> {
    const [image] = await this.db
      .delete(productImages)
      .where(
        and(
          eq(productImages.id, imageId),
          eq(productImages.productId, productId),
        ),
      )
      .returning({ id: productImages.id });

    if (!image) {
      throw new NotFoundException('Image not found');
    }
  }

  async reorder(productId: string, ids: string[]): Promise<ProductImageDto[]> {
    const current = await this.db
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, productId));
    const known = new Set(current.map((image) => image.id));

    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new BadRequestException(
        'ids must list every image of the product exactly once',
      );
    }

    await this.db.transaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx
          .update(productImages)
          .set({ sortOrder: index })
          .where(eq(productImages.id, id));
      }
    });

    return this.db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.sortOrder));
  }

  private async assertProduct(productId: string): Promise<void> {
    const [product] = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private async assertOptionValue(
    productId: string,
    optionValueId: string | null | undefined,
  ): Promise<void> {
    if (!optionValueId) {
      return;
    }

    const [value] = await this.db
      .select({ id: optionValues.id })
      .from(optionValues)
      .innerJoin(optionGroups, eq(optionGroups.id, optionValues.groupId))
      .where(
        and(
          eq(optionValues.id, optionValueId),
          eq(optionGroups.productId, productId),
        ),
      );

    if (!value) {
      throw new BadRequestException(
        'optionValueId does not belong to this product',
      );
    }
  }
}
