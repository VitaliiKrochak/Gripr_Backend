# Catalog module

Administrator management of everything customers see in the store. All routes
are admin-only and use canonical resource paths; the customer-facing view is
the [storefront](storefront.md).

## Reference data

- `GET|POST /api/metals`, `PATCH|DELETE /api/metals/:id`
- `GET|POST /api/gemstones`, `PATCH|DELETE /api/gemstones/:id`
- `GET|POST /api/finishing-options`, `PATCH|DELETE /api/finishing-options/:id`
- `GET|POST /api/tags`, `PATCH|DELETE /api/tags/:id`

Metals, gemstones, and finishing options have a unique `code` (slug) used in
storefront filters, a display name, sort order, and `isActive`. Metals also
have a `family` (`gold`, `silver`, `platinum`, `palladium`, `other`), purity,
colour, and an optional `pricePerGram` in kopiykas; changing the price per
gram recomputes the "price from" of every product that offers the metal.

Finishing options are the reusable workshop operations: `kind` is
`engraving` (mechanical, laser), `coating` (rhodium, white rhodium, black
rhodium, ruthenium, enamel, oxidation), or `processing` (pre-processing),
with a description, `defaultPrice`, and `productionDays`. The seed adds these
nine options.

Deleting reference data used by products answers `409`; deactivate it
instead. Deleting a tag detaches it from products.

## Collections

- `GET /api/collections?status=`, `GET /api/collections/:id`
- `POST /api/collections`, `PATCH /api/collections/:id`,
  `DELETE /api/collections/:id`

A collection has a slug, name, subtitle, story text (`description`), cover
image, gallery, SEO fields, `isFeatured`, and a publication `status`
(`draft`, `published`, `archived`). A collection marked `isSet` is sold as a
set: for every complete set in the cart (one unit of each published piece of
the collection), `setDiscountPercent` is taken off those units. Deleting a
collection keeps its products and removes them from the collection.

`productIds` on create or update replaces the collection's products in the
given order (the storefront shows them in that order); products left out are
removed from the collection. A product belongs to at most one collection, so
adding it moves it from its previous collection. Collection responses include
the ordered `products` (id, slug, name, type, status, first image).

## Products

- `GET /api/products?status=&collectionId=&type=&q=`, `GET /api/products/:id`
- `POST /api/products`, `PATCH /api/products/:id`, `DELETE /api/products/:id`

A product has a slug, name, type (ring, earrings, pendant, necklace, chain,
bracelet, brooch, cufflinks, other), short and long description,
specification rows, collection, tags (`tagIds` replaces all tags), flags
(`isHot`, `isNew`, `isFeatured`), `basePrice` (the manufacturing price) in
kopiykas, `weightGrams`, `widthMm`, `heightMm`, production time
(`productionDaysMin/Max`), `availability` (`in_stock` or `made_to_order`),
`stockQuantity`, sort order, SEO fields, and `status`. Admin responses also
include the computed `priceFrom`.

Only `published` products are visible in the storefront; drafts and archived
products answer `404` there (product page, quote, recommendations, cart,
favorites) and are left out of listings, search, and collections. Staff can
preview any product with `GET /api/products/:id/preview` and
`POST /api/products/:id/preview/quote` (storefront shapes).
`publishedAt` records the first publication. Prefer archiving to deleting:
deleting a product removes it from carts and favorites, while existing orders
keep their item snapshots.

### Saving the whole product

`POST /api/products` and `PATCH /api/products/:id` accept the full editor
state in one request, in one transaction:

- `stones`: stone groups with `gemstoneId`, `variation`, `sizeMm`, `carat`,
  `quantity`, and `unitPrice` (per stone, kopiykas).
- `optionGroups`: groups with their `values`.
- `images`: images with `publicId`, `url`, `alt`, and `optionValueId`.

Each list, when sent, replaces the current rows: rows with a known `id` are
updated, rows without one (or with a new client-generated UUID, which lets an
image reference a value created in the same request) are inserted, and
missing rows are deleted. Array order becomes the display order, and only the
first `isDefault` value of a group is kept. Group names and value labels may
be left empty; they are derived from the kind, product type, and referenced
metal, stone, size, or finishing option (for example "Довжина" and "45 см"
for chains).

For `in_stock` products, `stockQuantity` limits how many can be ordered and is
reserved at checkout. Set their production days to the time needed to prepare
and ship a ready piece.

Products created from an approved open-license design carry `designCredit`
(author, source, and license) and cannot be published while `priceFrom` is 0;
that `PATCH` answers `409`. See [designs](designs.md).

### Images

- `POST /api/products/:id/images`
- `PATCH /api/products/:id/images/:imageId`,
  `DELETE /api/products/:id/images/:imageId`
- `PUT /api/products/:id/images/order` with `{ "ids": [...] }`

Images are uploaded to the `products` media folder first. An image can be
linked to an option value (for example the white-gold variant) with
`optionValueId`.

### Configurator options

- `POST /api/products/:id/option-groups`
- `PATCH|DELETE /api/products/:id/option-groups/:groupId`
- `POST /api/products/:id/option-groups/:groupId/values`
- `PATCH|DELETE /api/products/:id/option-groups/:groupId/values/:valueId`

These granular routes remain for small edits; the admin editor saves the
whole product instead.

An option group has a `kind` (`metal`, `stone`, `size`, `engraving`,
`coating`, `processing`, `custom`), a name, `isRequired`, and sort order.
Values carry a label and, depending on the kind, `metalId`, `gemstoneId`,
`stoneCarat`, `stoneSizeMm`, `sizeValue`, or `finishingId` (a finishing
option of the same kind), plus `priceDelta` (kopiykas, may be negative),
`weightDeltaGrams`, `productionDaysDelta`, `isDefault` (one per group), and
`isAvailable`.

Sizes depend on the product type (`src/modules/catalog/product.types.ts`):
rings use ring sizes, chains, necklaces, and bracelets use a length in
centimetres, and other types have no size. Sizes are ordinary values of a
`size` group, so every size can have its own surcharge and weight change. An
`engraving` group enables engraving text of up to 40 characters.

Option mutations return the full product.

## Pricing

The configured unit price is the sum of:

- manufacturing: `basePrice`;
- metal: the selected metal's `pricePerGram` × (`weightGrams` + the
  `weightDeltaGrams` of the selected values), when both are set;
- stones: `quantity` × `unitPrice` of every stone group;
- options: the `priceDelta` of every selected value.

Quotes return this `breakdown` with the resulting weight. Production time is
the product range plus the `productionDaysDelta` of the selected values.
Required groups fall back to their default value; at most one value per group
can be selected, and the price cannot become negative.

`priceFrom` is the price of the default configuration (manufacturing plus
stones when a required group has no default). It is stored on the product,
recomputed whenever the product, its options, or a metal price changes, and
used for cards, price filters, and sorting. Products without a weight or
metal price per gram keep their previous prices.
