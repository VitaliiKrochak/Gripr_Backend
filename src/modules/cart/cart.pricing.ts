import {
  applySetDiscounts,
  combineProductionDays,
  ConfigurableProduct,
  Configuration,
  configureProduct,
  ConfigurationError,
  ProductSet,
} from '../catalog/product.configuration';

export interface CartLineInput {
  id: string;
  productId: string;
  optionValueIds: string[];
  engravingText: string | null;
  quantity: number;
}

export interface CartProduct extends ConfigurableProduct {
  id: string;
  availability: 'in_stock' | 'made_to_order';
  stockQuantity: number;
}

export interface PricedCartLine<P extends CartProduct = CartProduct> {
  input: CartLineInput;
  product: P | null;
  configuration: Configuration | null;
  unavailableReason: string | null;
  fromStock: boolean;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface PricedCart<P extends CartProduct = CartProduct> {
  lines: PricedCartLine<P>[];
  subtotal: number;
  discount: number;
  total: number;
  productionDaysMin: number;
  productionDaysMax: number;
  hasUnavailableItems: boolean;
}

/**
 * Prices cart lines against the current catalog. Lines that can no longer be
 * bought stay in the result with `unavailableReason` and are excluded from
 * totals.
 */
export function priceCart<P extends CartProduct>(
  inputs: CartLineInput[],
  products: Map<string, P>,
  sets: ProductSet[],
): PricedCart<P> {
  const requestedStock = new Map<string, number>();

  for (const input of inputs) {
    requestedStock.set(
      input.productId,
      (requestedStock.get(input.productId) ?? 0) + input.quantity,
    );
  }

  const lines = inputs.map((input): PricedCartLine<P> => {
    const product = products.get(input.productId) ?? null;
    const base = {
      input,
      product,
      configuration: null,
      fromStock: product?.availability === 'in_stock',
      unitPrice: 0,
      discount: 0,
      lineTotal: 0,
    };

    if (!product) {
      return { ...base, unavailableReason: 'Product is no longer available' };
    }

    if (
      product.availability === 'in_stock' &&
      requestedStock.get(product.id)! > product.stockQuantity
    ) {
      return {
        ...base,
        unavailableReason: `Only ${product.stockQuantity} left in stock`,
      };
    }

    try {
      const configuration = configureProduct(
        product,
        input.optionValueIds,
        input.engravingText,
      );

      return {
        ...base,
        configuration,
        unavailableReason: null,
        unitPrice: configuration.unitPrice,
      };
    } catch (error) {
      if (error instanceof ConfigurationError) {
        return { ...base, unavailableReason: error.message };
      }

      throw error;
    }
  });

  const available = lines.filter((line) => line.configuration);
  const discounts = applySetDiscounts(
    available.map((line) => ({
      key: line.input.id,
      productId: line.input.productId,
      unitPrice: line.unitPrice,
      quantity: line.input.quantity,
    })),
    sets,
  );

  for (const line of available) {
    line.discount = discounts.get(line.input.id) ?? 0;
    line.lineTotal = line.unitPrice * line.input.quantity - line.discount;
  }

  const subtotal = available.reduce(
    (sum, line) => sum + line.unitPrice * line.input.quantity,
    0,
  );
  const discount = available.reduce((sum, line) => sum + line.discount, 0);

  return {
    lines,
    subtotal,
    discount,
    total: subtotal - discount,
    ...combineProductionDays(available.map((line) => line.configuration!)),
    hasUnavailableItems: available.length !== lines.length,
  };
}
