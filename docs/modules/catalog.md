# Catalog module

Administrator management of everything customers see in the store. All routes
are admin-only and use canonical resource paths; the customer-facing view is
the [storefront](storefront.md).

## Reference data

- `GET|POST /api/metals`, `PATCH|DELETE /api/metals/:id`
- `GET|POST /api/gemstones`, `PATCH|DELETE /api/gemstones/:id`
- `GET|POST /api/tags`, `PATCH|DELETE /api/tags/:id`

Metals and gemstones have a unique `code` (slug) used in storefront filters, a
display name, sort order, and `isActive`. Deleting a metal or gemstone used by
an option value answers `409`; deactivate it instead. Deleting a tag detaches
it from products.

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

## Products

- `GET /api/products?status=&collectionId=&type=&q=`, `GET /api/products/:id`
- `POST /api/products`, `PATCH /api/products/:id`, `DELETE /api/products/:id`

A product has a slug, name, type (ring, earrings, pendant, necklace, bracelet,
brooch, other), short and long description, specification rows, collection,
tags (`tagIds` replaces all tags), flags (`isHot`, `isNew`, `isFeatured`),
`basePrice` in kopiykas, production time (`productionDaysMin/Max`),
`availability` (`in_stock` or `made_to_order`), `stockQuantity`, sort order,
SEO fields, and `status`. Setting `status` to `published` makes the product
visible in the storefront; `publishedAt` records the first publication.
Prefer archiving to deleting: deleting a product removes it from carts and
favorites, while existing orders keep their item snapshots.

For `in_stock` products, `stockQuantity` limits how many can be ordered and is
reserved at checkout. Set their production days to the time needed to prepare
and ship a ready piece.

Products created from an approved open-license design carry `designCredit`
(author, source, and license) and cannot be published while `basePrice` is 0;
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

An option group has a `kind` (`metal`, `stone`, `size`, `engraving`,
`custom`), a name, `isRequired`, and sort order. Values carry a label and,
depending on the kind, `metalId`, `gemstoneId`, `stoneCarat`, `stoneSizeMm`,
or `ringSize`, plus `priceDelta` (kopiykas, may be negative),
`productionDaysDelta`, `isDefault` (one per group), and `isAvailable`. Ring
sizes are ordinary values of a `size` group, so every size can have its own
surcharge. An `engraving` group enables engraving text of up to 40 characters.

Option mutations return the full product.

## Pricing

The configured unit price is `basePrice` plus the `priceDelta` of every
selected value. Production time is the product range plus the
`productionDaysDelta` of the selected values. Required groups fall back to
their default value; at most one value per group can be selected, and the
price cannot become negative.
