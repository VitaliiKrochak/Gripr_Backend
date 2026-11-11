import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { and, asc, eq, getTableColumns, inArray } from 'drizzle-orm';
import { DATABASE } from '../../integrations/database/database.client';
import type {
  Database,
  DatabaseExecutor,
} from '../../integrations/database/database.client';
import {
  cartItems,
  collections,
  products,
} from '../../integrations/database/database.schema';
import type { Store } from '../../integrations/database/database.schema';
import {
  ConfigurableProductRecord,
  isPublished,
  ProductCatalogService,
} from '../catalog/product.catalog.service';
import {
  configureProduct,
  ConfigurationError,
} from '../catalog/product.configuration';
import { CustomersService } from '../customers/customers.service';
import { loadCartPrints } from '../prints/print.requests.cart';
import type { CartPrint } from '../prints/print.requests.cart';
import {
  AddCartItemDto,
  CartDto,
  MAX_LINE_QUANTITY,
  UpdateCartItemDto,
} from './cart.dto';
import { priceCart, PricedCart } from './cart.pricing';

/** The priced cart with the confirmed Lab prints, which the totals include. */
export type PricedStoreCart = PricedCart<ConfigurableProductRecord> & {
  prints: CartPrint[];
};

@Injectable()
export class CartService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly catalog: ProductCatalogService,
    private readonly customers: CustomersService,
  ) {}

  async get(user: User, store: Store): Promise<CartDto> {
    return this.toDto(store, await this.price(user.id, store));
  }

  /**
   * Prices the stored cart against the current catalog. With `lock` the
   * Lab prints are locked for checkout.
   */
  async price(
    customerId: string,
    store: Store,
    executor: DatabaseExecutor = this.db,
    { lock = false } = {},
  ): Promise<PricedStoreCart> {
    const items = await executor
      .select(getTableColumns(cartItems))
      .from(cartItems)
      .innerJoin(products, eq(products.id, cartItems.productId))
      .where(
        and(eq(cartItems.customerId, customerId), eq(products.store, store)),
      )
      .orderBy(asc(cartItems.createdAt));
    const productMap = await this.catalog.loadConfigurable(
      [...new Set(items.map((item) => item.productId))],
      executor,
    );
    const sets = await this.catalog.loadSets(
      [...productMap.values()].flatMap((p) => p.collectionId ?? []),
      executor,
    );

    const cart = priceCart(items, productMap, sets);
    const prints =
      store === 'lab'
        ? await loadCartPrints(executor, customerId, { lock })
        : [];

    return withPrints(cart, prints);
  }

  async add(user: User, dto: AddCartItemDto): Promise<CartDto> {
    const product = await this.loadProduct(dto.productId);
    const configuration = this.configure(
      product,
      dto.optionValueIds ?? [],
      dto.engravingText,
    );
    await this.customers.ensure(user);

    const existing = (
      await this.db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.customerId, user.id),
            eq(cartItems.productId, product.id),
          ),
        )
    ).find(
      (item) =>
        item.engravingText === configuration.engravingText &&
        sameIds(item.optionValueIds, configuration.optionValueIds),
    );

    if (existing) {
      await this.db
        .update(cartItems)
        .set({
          quantity: Math.min(
            existing.quantity + (dto.quantity ?? 1),
            MAX_LINE_QUANTITY,
          ),
        })
        .where(eq(cartItems.id, existing.id));
    } else {
      await this.db.insert(cartItems).values({
        customerId: user.id,
        productId: product.id,
        optionValueIds: configuration.optionValueIds,
        engravingText: configuration.engravingText,
        quantity: dto.quantity ?? 1,
      });
    }

    return this.get(user, product.store);
  }

  async update(
    user: User,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartDto> {
    const item = await this.findItem(user.id, itemId);
    const changes: Partial<typeof cartItems.$inferInsert> = {};

    if (dto.optionValueIds !== undefined || dto.engravingText !== undefined) {
      const configuration = this.configure(
        await this.loadProduct(item.productId),
        dto.optionValueIds ?? item.optionValueIds,
        dto.engravingText === undefined
          ? item.engravingText
          : dto.engravingText,
      );
      changes.optionValueIds = configuration.optionValueIds;
      changes.engravingText = configuration.engravingText;
    }

    if (dto.quantity !== undefined) {
      changes.quantity = dto.quantity;
    }

    if (Object.keys(changes).length) {
      await this.db
        .update(cartItems)
        .set(changes)
        .where(eq(cartItems.id, item.id));
    }

    return this.get(user, item.store);
  }

  async remove(user: User, itemId: string): Promise<CartDto> {
    const item = await this.findItem(user.id, itemId);
    await this.db.delete(cartItems).where(eq(cartItems.id, itemId));
    return this.get(user, item.store);
  }

  /** Removes the customer's lines of one store; the other store's stay. */
  async clear(
    customerId: string,
    store: Store,
    executor: DatabaseExecutor = this.db,
  ) {
    await executor
      .delete(cartItems)
      .where(
        and(
          eq(cartItems.customerId, customerId),
          inArray(
            cartItems.productId,
            executor
              .select({ id: products.id })
              .from(products)
              .where(eq(products.store, store)),
          ),
        ),
      );
  }

  /** Adds one default-configured piece of every product in a set. */
  async addSet(user: User, collectionSlug: string): Promise<CartDto> {
    const rows = await this.db
      .select({ id: products.id, store: products.store })
      .from(products)
      .innerJoin(collections, eq(collections.id, products.collectionId))
      .where(
        and(
          eq(collections.slug, collectionSlug),
          eq(collections.status, 'published'),
          eq(collections.isSet, true),
          isPublished,
        ),
      );

    if (!rows.length) {
      throw new NotFoundException('Set not found');
    }

    const productMap = await this.catalog.loadConfigurable(
      rows.map((row) => row.id),
    );
    const configured = [...productMap.values()].map((product) => ({
      product,
      configuration: this.configure(product, []),
    }));
    await this.customers.ensure(user);
    await this.db.insert(cartItems).values(
      configured.map(({ product, configuration }) => ({
        customerId: user.id,
        productId: product.id,
        optionValueIds: configuration.optionValueIds,
      })),
    );

    return this.get(user, rows[0].store);
  }

  toDto(store: Store, cart: PricedStoreCart): CartDto {
    return {
      store,
      items: cart.lines.map((line) => ({
        id: line.input.id,
        productId: line.input.productId,
        productSlug: line.product?.slug ?? null,
        productName: line.product?.name ?? null,
        imageUrl: line.product?.images[0]?.url ?? null,
        optionValueIds: line.input.optionValueIds,
        selectedOptions: line.configuration?.selectedOptions ?? [],
        engravingText: line.input.engravingText,
        quantity: line.input.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        lineTotal: line.lineTotal,
        productionDaysMin: line.configuration?.productionDaysMin ?? 0,
        productionDaysMax: line.configuration?.productionDaysMax ?? 0,
        fromStock: line.fromStock,
        unavailableReason: line.unavailableReason,
      })),
      prints: cart.prints,
      subtotal: cart.subtotal,
      discount: cart.discount,
      total: cart.total,
      productionDaysMin: cart.productionDaysMin,
      productionDaysMax: cart.productionDaysMax,
      hasUnavailableItems: cart.hasUnavailableItems,
    };
  }

  private async loadProduct(productId: string) {
    const product = (await this.catalog.loadConfigurable([productId])).get(
      productId,
    );

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private configure(
    product: ConfigurableProductRecord,
    optionValueIds: string[],
    engravingText?: string | null,
  ) {
    try {
      return configureProduct(product, optionValueIds, engravingText);
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw new BadRequestException(`${product.name}: ${error.message}`);
      }

      throw error;
    }
  }

  private async findItem(customerId: string, itemId: string) {
    const [item] = await this.db
      .select({ ...getTableColumns(cartItems), store: products.store })
      .from(cartItems)
      .innerJoin(products, eq(products.id, cartItems.productId))
      .where(
        and(eq(cartItems.id, itemId), eq(cartItems.customerId, customerId)),
      );

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    return item;
  }
}

/** Adds the available prints to the totals; prints have no set discounts. */
function withPrints(
  cart: PricedCart<ConfigurableProductRecord>,
  prints: CartPrint[],
): PricedStoreCart {
  const available = prints.filter((print) => !print.unavailableReason);
  const printsTotal = available.reduce((sum, print) => sum + print.total, 0);

  return {
    ...cart,
    prints,
    subtotal: cart.subtotal + printsTotal,
    total: cart.total + printsTotal,
    productionDaysMin: Math.max(
      cart.productionDaysMin,
      ...available.map((print) => print.productionDaysMin),
    ),
    productionDaysMax: Math.max(
      cart.productionDaysMax,
      ...available.map((print) => print.productionDaysMax),
    ),
    hasUnavailableItems:
      cart.hasUnavailableItems || available.length !== prints.length,
  };
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}
