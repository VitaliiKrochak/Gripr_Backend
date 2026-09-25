# Cart module

The signed-in customer's server-side cart. Every response is repriced from the
current catalog, so prices and availability are always up to date.

## Routes

- `GET /api/customers/me/cart`
- `POST /api/customers/me/cart/items` with
  `{ "productId", "optionValueIds"?, "engravingText"?, "quantity"? }`
  (`200`): adds a configured product. Adding an identical configuration
  increases its quantity (at most 10 per line). Invalid configurations answer
  `400`.
- `PATCH /api/customers/me/cart/items/:itemId`: change options, engraving, or
  quantity.
- `DELETE /api/customers/me/cart/items/:itemId`
- `DELETE /api/customers/me/cart` (`204`): empty the cart.
- `POST /api/customers/me/cart/sets/:collectionSlug`: add every published
  piece of a set with default options.

## Cart response

Each line has the product snapshot, `selectedOptions`, `unitPrice`, the set
`discount`, `lineTotal`, production time, `fromStock`, and
`unavailableReason`. The cart has `subtotal`, `discount`, `total`, the order
production estimate (the longest line, since pieces are made in parallel), and
`hasUnavailableItems`.

A line becomes unavailable when the product is unpublished, an option is no
longer available, or there is not enough stock across all lines of an
in-stock product. Checkout is refused until such lines are fixed or removed.

Set discounts apply to every complete set in the cart: one unit of each
published piece of a set collection gets the collection's
`setDiscountPercent` off.
