import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { and, desc, eq } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type { Database } from '../../integrations/database/database.client';
import {
  favorites,
  products,
} from '../../integrations/database/database.schema';
import type { ProductCardDto } from '../catalog/dto/product.card.dto';
import {
  isPublished,
  ProductCatalogService,
} from '../catalog/product.catalog.service';
import { CustomersService } from '../customers/customers.service';

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly customers: CustomersService,
    private readonly catalog: ProductCatalogService,
  ) {}

  async list(user: User): Promise<ProductCardDto[]> {
    const rows = await this.db
      .select({ productId: favorites.productId })
      .from(favorites)
      .where(eq(favorites.customerId, user.id))
      .orderBy(desc(favorites.createdAt));

    return this.catalog.cardsByIds(rows.map((row) => row.productId));
  }

  async add(user: User, productId: string): Promise<void> {
    const [product] = await this.db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), isPublished));

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.customers.ensure(user);
    await this.db
      .insert(favorites)
      .values({ customerId: user.id, productId })
      .onConflictDoNothing();
  }

  async remove(user: User, productId: string): Promise<void> {
    await this.db
      .delete(favorites)
      .where(
        and(
          eq(favorites.customerId, user.id),
          eq(favorites.productId, productId),
        ),
      );
  }
}
