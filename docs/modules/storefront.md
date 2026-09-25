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
  specifications, available option values, and `defaultQuote` for the default
  configuration.
- `POST /api/storefront/products/:slug/quote` with
  `{ "optionValueIds": [...], "engravingText"? }`: price and production time
  for a configuration. Invalid selections answer `400` with a message.
- `GET /api/storefront/products/:slug/recommendations?limit=`: related
  products ranked by same collection, shared tags, same type, then hot items.
- `GET /api/storefront/collections`: published collections with
  `productCount`.
- `GET /api/storefront/collections/:slug`: collection story, gallery, and
  product cards. For sets, `setPrice` and `setPriceDiscounted` show the price
  of the whole set with default options.

## Product cards

A card contains the slug, name, type, flags, `priceFrom` (the price with
default options, in kopiykas), `inStock`, up to two images, the available
metals, and the collection summary.
