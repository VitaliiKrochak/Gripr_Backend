# Catalog module

Administrator management of everything customers see in the store. All routes
are admin-only and use canonical resource paths; the customer-facing view is
the [storefront](storefront.md).

Products, collections, and tags belong to one of the two
[stores](../architecture.md#stores), `gripr` or `lab`. Their lists take
`?store=` (`gripr` by default) and their responses include `store`. Metals,
gemstones, and finishing options are Gripr reference data.

## Reference data

- `GET|POST /api/metals`, `PATCH|DELETE /api/metals/:id`
- `GET|POST /api/gemstones`, `PATCH|DELETE /api/gemstones/:id`
- `GET|POST /api/finishing-options`, `PATCH|DELETE /api/finishing-options/:id`
- `GET /api/tags?store=`, `POST /api/tags`, `PATCH|DELETE /api/tags/:id`

Metals, gemstones, and finishing options have a unique `code` (slug) used in
storefront filters, a display name, sort order, and `isActive`. Metals also
have a `family` (`gold`, `silver`, `platinum`, `palladium`, `other`), purity,
colour, and an optional `pricePerGram` in kopiykas; changing the price per
gram, family, or purity reprices auto-priced products and recomputes the
"price from" of every product that offers the metal. Workshop tariffs of a
metal are managed by the [pricing](pricing.md#metals) module.

Finishing options are the reusable workshop operations: `kind` is
`engraving` (mechanical, laser), `coating` (rhodium, white rhodium, black
rhodium, ruthenium, enamel, oxidation), or `processing` (pre-processing),
with a description, `defaultPrice`, and `productionDays`. The seed adds these
nine options.

Deleting reference data used by products answers `409`; deactivate it
instead. Deleting a tag detaches it from products.

A tag is created in a `store` (`gripr` by default) that cannot be changed
later, and only products of that store can use it (`400` otherwise). Tag
slugs are unique across both stores.

## Collections

- `GET /api/collections?store=&status=`, `GET /api/collections/:id`
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

A collection is created in a `store` (`gripr` by default) that cannot be
changed later. It holds only products of its store: `productIds` with a
product of the other store answers `400`. Collection slugs are unique across
both stores.

## Products

- `GET /api/products?store=&status=&collectionId=&type=&q=`,
  `GET /api/products/:id`
- `POST /api/products`, `PATCH /api/products/:id`, `DELETE /api/products/:id`

A product has a slug, name, type, short and long description,
specification rows, collection, tags (`tagIds` replaces all tags), flags
(`isHot`, `isNew`, `isFeatured`), `basePrice` (the manufacturing price) in
kopiykas, `weightGrams`, `widthMm`, `heightMm`, production time
(`productionDaysMin/Max`), `availability` (`in_stock` or `made_to_order`),
`stockQuantity`, sort order, SEO fields, and `status`. Admin responses also
include the computed `priceFrom`.

The type decides the product's store (`product.stores.ts`):

- Gripr: `ring`, `earrings`, `pendant`, `necklace`, `chain`, `bracelet`,
  `brooch`, `cufflinks`, `other`.
- Gripr Lab: `miniature`, `figurine`, `bust`, `statue`, `terrain`,
  `diorama`, `prop`, `other_print`.

An update may change the type only within the store (`400` otherwise). The
collection and tags must belong to the product's store. Lab products cannot
have fixed `stones` or the automatic jewelry `pricing` (`400`); they use the
print calculator through `print` (see [print pricing](#print-pricing)) or a
manual `basePrice`. Jewelry products cannot have `print` (`400`).

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
  `quantity`, and `unitPrice` (per stone, kopiykas), plus the calculator
  inputs `purchasePrice`, `settingType`, `cut`, and `settingCost`.
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

No product can be published while its `priceFrom` is 0: creating or updating
a published product answers `409` after repricing. This covers manual prices
of 0, products created from an approved open-license design (they carry
`designCredit` with the author, source, and license; see
[designs](designs.md)), and automatically priced Gripr Lab products the print
calculator cannot price yet (no printer or no active resin).

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

An option group has a `kind`, a name, `isRequired`, and sort order.
Values carry a label and, depending on the kind, `metalId`, `gemstoneId`,
`stoneCarat`, `stoneSizeMm`, `sizeValue`, or `finishingId` (a finishing
option of the same kind), plus `priceDelta` (kopiykas, may be negative),
`pricePerGram` on metal values (the metal's customer price per gram on this
product; `null` uses the metal's own price, and other kinds always store
`null`),
the stone calculator inputs `stoneQuantity`, `purchasePrice`, `settingType`,
`cut`, and `settingCost` (used for `stone` groups of automatically priced
products; never shown on the storefront),
`weightDeltaGrams`, `productionDaysDelta`, `isDefault` (one per group), and
`isAvailable`.

The allowed kinds depend on the store; other kinds answer `400`:

- Gripr: `metal`, `stone`, `size`, `engraving`, `coating`, `processing`,
  `custom`.
- Gripr Lab: `scale`, `resin`, `painting`, `base`, `finish`, `custom`.
  Besides the label, `priceDelta`, and `productionDaysDelta`, each kind has
  its print field: `scale` values `heightMm` (finished height, wins) or
  `scaleFactor` (factor of the reference model), `resin` values `resinId`,
  `painting` values `paintingMultiplier` (1 unpainted, 2 painted, 3 complex
  by default), and `finish` values `printFinish` (`raw`,
  `supports_removed`, `sanded`). A field sent for another kind is stored as
  `null`. Labels default to "60 мм", "× 0.5", the resin name, or the finish
  name ("Без обробки", "Без підтримок", "Відшліфовано"). A resin used by an
  option value cannot be deleted (`409`).

Sizes depend on the product type (`src/modules/catalog/product.types.ts`):
rings use ring sizes, chains, necklaces, and bracelets use a length in
centimetres, and other types (including every Lab type) have no size. Sizes are ordinary values of a
`size` group, so every size can have its own surcharge and weight change. An
`engraving` group enables engraving text of up to 40 characters.

Option mutations return the full product.

## Pricing

The configured unit price is the sum of:

- manufacturing: `basePrice`;
- metal: the price per gram of the selected metal value (its own
  `pricePerGram`, else the metal's) × (`weightGrams` + the
  `weightDeltaGrams` of the selected values), when both are set;
- stones: `quantity` × `unitPrice` of every stone group;
- options: the `priceDelta` of every selected value.

Quotes return this `breakdown` with the resulting weight. Production time is
the product range plus the `productionDaysDelta` of the selected values.
Required groups fall back to their default value; at most one value per group
can be selected, and the price cannot become negative.

`priceFrom` is the price of the default configuration: the default value of
every required group, or its first available value when none is marked as
default (manufacturing plus stones when a required group has no available
value). The storefront `defaultQuote` uses the same selection, while quotes
and the cart still require an explicit default or selection. The staff
editor offers stones only as `stone` option values, so a configuration's
stones are part of the selected options. Each `stone` group is one stone
place of the piece (for example a centre stone and side stones); every value
of the group stores the place's `stoneQuantity` and `stoneSizeMm`, and its
`priceDelta` is the price of all stones of that place. It is stored on the product,
recomputed whenever the product, its options, or a metal price changes, and
used for cards, price filters, and sorting. Products without a weight or
metal price per gram keep their previous prices.

### Automatic pricing

`pricing` on create or update stores the price calculator inputs: `mode`
(`auto` or `manual`), `metalId` (when there is no metal option group), work
type and hours, jeweler and setter (`owner` or `hired`), scenario, urgency,
extra profit, delivery/packaging/consumables (`null` uses the settings),
`services`, `fittings`, and `overrides`. In `auto` mode the server calculates
`basePrice`, the unit price of stones with a purchase price or setting type,
and the `priceDelta` of metal option values on every save, ignoring the sent
values; see [pricing](pricing.md#auto-priced-products). `null` (existing
products) or `manual` keeps hand-entered prices. `pricing` and the stone
purchase fields are admin-only and never returned by the storefront.

### Print pricing

`print` on a Lab product stores the print calculator inputs at the model's
reference size: `mode` (`auto` or `manual`), `volumeMl` (without
supports), `sizeMm` (`x`, `y`, and the printed height `z`), and `overrides`
(`supportRate`, `resinMl`, `printHours`, `plateShare`; missing ones are
stored as `null`). With `printFileId` (a measured
[model file](prints.md#product-models) of the product, set on update) the
volume and size are copied from the file and may be omitted. In `auto` mode the unit price is not added up from
surcharges: every selection is priced as a whole by the
[print calculator](prints.md#print-calculator), because the resin grows
with the cube of the size. The selected scale, resin (else the default
resin), finish (else `supports_removed`), and painting multiplier are its
inputs, and the `priceDelta` of the selected values (for example a base) is
added to the cost before the markup. `basePrice` is ignored, quote
breakdowns put the whole price into `manufacturing`, and the production
time is the print settings range plus the `productionDaysDelta` of the
selected values. `priceFrom` is the cheapest combination of the available
values of the required groups (the default configuration beyond 2 000
combinations). An inactive resin makes its combinations unavailable.
`print` is admin-only.
