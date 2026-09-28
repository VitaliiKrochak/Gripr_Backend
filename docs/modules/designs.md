# Designs module

An open-license design library: a nightly importer collects jewelry 3D models
published on Sketchfab under licenses that allow commercial use, and staff
review them. Approving a design creates a draft product; the storefront lists
such products after our own and credits the original author publicly. All
routes are admin-only.

Only metadata and the preview image are imported. 3D files are never
downloaded by the API; staff download a model from Sketchfab when they decide
to produce it.

## Import

`DesignImportService` runs every night at 02:00 Europe/Kyiv
(`@nestjs/schedule`) and on demand. `DESIGN_IMPORT_ENABLED=false` disables the
nightly run; a manual run still works. The Sketchfab search API is public;
`SKETCHFAB_API_TOKEN` is optional and only raises rate limits.

For both licenses (`cc0`, `by`), each query (ring, pendant, earrings, necklace,
bracelet, brooch, charm, jewelry, jewellery) and each sort (most liked, newest),
the importer reads up to 5 pages of downloadable models, pausing between
requests. A failed request is counted and the rest of the run continues. Each
model is then filtered and scored by pure functions:

- `design.license.ts`: only `CC0 Public Domain` and `CC Attribution` are
  accepted. Anything else (NonCommercial, NoDerivs, ShareAlike, editorial,
  standard, unknown), non-downloadable, and age-restricted models are skipped.
- `design.relevance.ts`: a 0-100 jewelry relevance score from the title, tags,
  and description, with the suggested product type. Game assets and look-alike
  uses of the words (for example a boxing ring) are penalized; models below 40 are skipped.
- `design.ip.ts`: `blocked` when a franchise, character, or jewelry brand is
  named (with the matched terms), `review` for derivative signals such as
  "inspired" or "fan art", otherwise `low`.
- `design.popularity.ts`: after every import, each candidate gets a 0-100
  popularity score: 0.45 x likes percentile + 0.25 x views percentile + 0.30 x
  like-velocity percentile (likes per month since publication), ranked within
  its suggested type. Sketchfab does not expose download counts.

Rows are upserted by `(source, sourceId)`. A re-import refreshes metadata,
stats, and scores but never changes `status`, `productId`, or the review
fields. Only one run executes at a time; the summary of the current or last run
(fetched, new, updated, skipped by reason, failed requests) is kept in memory
until the API restarts.

## Routes

- `GET /api/design-candidates`: paginated list. Filters: `status`
  (`candidate` by default, `approved`, `rejected`), `type` (suggested type),
  `license` (`cc0`, `cc_by`), `ipRisk`, and `q` (title, author, tags). `sort`
  is `score` (default), `likes`, or `newest`. Candidates with `ipRisk=blocked`
  are listed only when that filter is requested.
- `GET /api/design-candidates/:id`: full details with the license name and URL,
  whether attribution is required, the Sketchfab embed URL, and IP matches.
- `POST /api/design-candidates/:id/approve` with
  `{ "type", "acknowledgeIpRisk"? }`: creates a draft product (name = model
  title, slug = transliterated title plus the first six characters of the
  Sketchfab uid, chosen type, `basePrice` 0), copies the preview image to the
  Cloudinary `products` folder as its first image, and links the candidate.
  Returns the admin product. Answers `409` unless the candidate is in the
  `candidate` status, and for `blocked` IP risk unless `acknowledgeIpRisk` is
  `true`. A failed preview copy is logged and the product is created without
  an image.
- `POST /api/design-candidates/:id/reject`: `candidate` to `rejected`.
- `POST /api/design-candidates/:id/restore`: back to `candidate` from
  `rejected`, or from `approved` when the linked product was deleted.
- `POST /api/design-candidates/import`: starts a run and answers `202` with its
  summary, or `409` while a run is in progress.
- `GET /api/design-candidates/import/status`: `running`, `enabled`, and the
  last-run summary.

## Products made from designs

A product linked to a candidate is an open-model product:

- `designCredit` on the admin and storefront product (title, author, author
  URL, source name and URL, license, license name and URL,
  `attributionRequired`) is public; the storefront shows it on the product
  page.
- It cannot be published while `basePrice` is 0 (`409`); staff set the price
  and options in the product editor first.
- Storefront listings always show it after our own products; see
  [storefront](storefront.md#ordering).
- Deleting the product unlinks the candidate (`productId` becomes `null`);
  staff can then restore it to the queue.
