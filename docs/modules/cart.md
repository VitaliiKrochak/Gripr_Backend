# Cart module

The signed-in customer's server-side cart. Every response is repriced from the
current catalog, so prices and availability are always up to date.

One cart holds products of both [stores](../architecture.md#stores), but it
is read, cleared, and checked out per store: a line belongs to its product's
store. `GET` and `DELETE /api/customers/me/cart` take `?store=` (`gripr` by
default). Responses carry `store` and only that store's lines; adding,
changing, or removing a line returns the cart of the line's store.

## Routes

- `GET /api/customers/me/cart?store=`
- `POST /api/customers/me/cart/items` with
  `{ "productId", "optionValueIds"?, "engravingText"?, "quantity"? }`
  (`200`): adds a configured product. Adding an identical configuration
  increases its quantity (at most 10 per line). Invalid configurations answer
  `400`.
- `PATCH /api/customers/me/cart/items/:itemId`: change options, engraving, or
  quantity.
- `DELETE /api/customers/me/cart/items/:itemId`
- `DELETE /api/customers/me/cart?store=` (`204`): empty the store's lines.
- `POST /api/customers/me/cart/sets/:collectionSlug`: add every published
  piece of a set with default options.

## Cart response

Each line in `items` has the product snapshot, `selectedOptions`, `unitPrice`, the set
`discount`, `lineTotal`, production time, `fromStock`, and
`unavailableReason`. The cart has `subtotal`, `discount`, `total`, the order
production estimate (the longest line, since pieces are made in parallel), and
`hasUnavailableItems`.

Print-priced Lab products are priced per selection by the print calculator
with the current settings, printer, resin, and USD rate.

A line becomes unavailable when the product is unpublished, an option is no
longer available (including an inactive resin, or Lab printing without a
printer), or there is not enough stock across all lines of an
in-stock product. Checkout is refused until such lines are fixed or removed.

Set discounts apply to every complete set in the cart: one unit of each
published piece of a set collection gets the collection's
`setDiscountPercent` off.

## Lab prints

A confirmed [print request](prints.md#print-requests) put into the cart
(`POST /api/customers/me/print-requests/:id/cart`) is a Lab cart entry of its
own: the Lab cart's `prints` lists each with `requestId`, its `items`
(`fileName`, `quantity`, `unitPrice`, `lineTotal`, `selectedOptions`), the
confirmed `total`, production days, `priceValidUntil`, and
`unavailableReason`. Prints have no quantity or option edits; take one out
with `DELETE /api/customers/me/print-requests/:id/cart`. The cart `subtotal`,
`total`, and production estimate include the available prints; a print whose
confirmed price expired is unavailable, which blocks checkout like other
unavailable lines. The Gripr cart always has `prints: []`, and clearing the
cart leaves prints in it.