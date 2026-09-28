# Storefront module

The public, read-only view of the published catalog, the configurator quote,
and recommendations. All routes are public. Only published products and
collections are returned; drafts and archived records answer `404`.

## Routes

- `GET /api/storefront/home`: featured collections, hot, new, and featured
  product cards.
- `GET /api/storefront/filters`: product types, tags, active metals and
  gemstones, collections, and the price range available for filtering.
- `GET /api/storefront/products`: paginated product cards. Filters:
  `collection` (slug), `tags`, `metals`, `gemstones` (codes, comma-separated
  or repeated; any match), `type`, `priceMin`, `priceMax` (kopiykas, against
  the "price from"), `inStock`, `hot`, `new`, `q` (name and short
  description), and `sort` (`featured`, `newest`, `price_asc`,
  `price_desc`).
- `GET /api/storefront/products/:slug`: product details with images, tags,
  specifications, available option values, `defaultQuote` for the default
  configuration, and `designCredit` (see below).
- `POST /api/storefront/products/:slug/quote` with
  `{ "optionValueIds": [...], "engravingText"? }`: price and production time
  for a configuration. Invalid selections answer `400` with a message.
- `GET /api/storefront/products/:slug/recommendations?limit=`: related
  products, own products first, then ranked by same collection, shared tags,
  same type, and hot items.
- `GET /api/storefront/collections`: published collections with
  `productCount`.
- `GET /api/storefront/collections/:slug`: collection story, gallery, and
  product cards. For sets, `setPrice` and `setPriceDiscounted` show the price
  of the whole set with default options.

## Ordering

Products made from open-license [designs](designs.md) always come after our
own products, in every listing (catalog, home sections, collections, and
recommendations) and for every sort. The rule lives in
`src/modules/catalog/product.order.ts`:

- `featured` (default): own products by `isFeatured` then manual position;
  open models by `isFeatured`, then popularity score, then position.
- Home sections and collections use the same position order: open models by
  popularity, own products by `sortOrder` and publication date.
- `newest`, `price_asc`, `price_desc`: the requested order within each group.

The popularity score is used for sorting only and is never returned to
customers.

## Design credit

`designCredit` is `null` for our own products. For products made from an
open-license design it contains the model `title`, `author`, `authorUrl`,
`sourceName` (Sketchfab), `sourceUrl`, `license` (`cc0` or `cc_by`),
`licenseName`, `licenseUrl`, and `attributionRequired`. The frontend must show
it publicly on the product page.

## Product cards

A card contains the slug, name, type, flags, `priceFrom` (the price with
default options, in kopiykas), `inStock`, up to two images, the available
metals, and the collection summary.
