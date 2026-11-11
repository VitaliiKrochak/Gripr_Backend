# Designs module

An open-license design library for both [stores](../architecture.md#stores).
A nightly importer collects 3D models published under licenses that allow
commercial use: jewelry from Sketchfab for Gripr, and miniatures, figurines,
busts, and terrain from Sketchfab and Thingiverse for Gripr Lab. Staff can also
import one model by its link, including Printables and MyMiniFactory models.
Staff review the candidates. Approving a design creates a draft product; the
storefront lists such products after our own and credits the original author
publicly. All routes are admin-only.

Only metadata and the preview image are imported. 3D files are never
downloaded by the API; staff download a model from its source when they
decide to produce it.

## Sources and licenses

| Source        | Nightly import | Import by link |
| ------------- | -------------- | -------------- |
| Sketchfab     | Gripr, Lab     | Gripr, Lab     |
| Thingiverse   | Lab            | Gripr, Lab     |
| Printables    | -              | Gripr, Lab     |
| MyMiniFactory | -              | Gripr, Lab     |

The MyMiniFactory API is not integrated yet; its models are imported by link.

Gripr accepts `cc0` and `cc_by`. Gripr Lab also accepts `cc_by_sa` (our
changes to the file must be shared under the same license) and `cc_by_nd`
(the model may be scaled and printed, not remixed). NonCommercial, editorial,
standard, unknown, and licenses with both ShareAlike and NoDerivatives are
skipped everywhere. The admin candidate shows `attributionRequired`,
`shareAlike`, and `derivativesAllowed`.

## Import

`DesignImportService` runs every night at 02:00 Europe/Kyiv
(`@nestjs/schedule`) and on demand. `DESIGN_IMPORT_ENABLED=false` disables the
nightly run; a manual run still works. The Sketchfab search API is public;
`SKETCHFAB_API_TOKEN` is optional and only raises rate limits. Thingiverse is
imported only when `THINGIVERSE_API_TOKEN` is set.

- **Sketchfab**: for both licenses (`cc0`, `by`), each query of the store, and
  each sort (most liked, newest), the importer reads up to 5 pages of
  downloadable models. Gripr queries: ring, pendant, earrings, necklace,
  bracelet, brooch, charm, jewelry, jewellery. Lab queries: miniature,
  figurine, bust, statue, tabletop, dragon, terrain, diorama, 3d print,
  printable.
- **Thingiverse** (Lab only): for each license filter (public domain, CC BY,
  CC BY-SA, CC BY-ND) and each Lab query, up to 2 pages of the most liked
  things. Search results do not carry the license, so the importer reads the
  details of up to 150 things per run: unknown things first (most liked
  first), then known ones refreshed longest ago. The rest wait for the next
  run. The license is always taken from the thing details.

The importer pauses between requests. A failed request is counted and the rest
of the run continues. Each model is then filtered and scored per store by pure
functions:

- `design.license.ts`: maps the source's license label to one of the store's
  accepted licenses. Non-downloadable and age-restricted (Thingiverse NSFW)
  models are skipped.
- `design.relevance.ts`: a 0-100 relevance score from the title, tags, and
  description, with the suggested product type of the store. Gripr scores
  jewelry and penalizes game assets and look-alike uses of the words (for
  example a boxing ring). Lab scores miniatures, figurines, busts, statues,
  terrain, dioramas, and props, rewards print terms (presupported, resin, STL),
  and penalizes rigged game assets, textures, and jewelry. Models below 40
  are skipped.
- `design.ip.ts`: `blocked` when a franchise, character, or brand is named
  (with the matched terms), `review` for derivative signals such as "inspired"
  or "fan art", otherwise `low`. In Lab, tabletop systems and fan-made proxies
  (D&D, Pathfinder, 40k, "proxy") are `review`. A `cc_by_nd` model is at least
  `review` with the match `license: no derivatives`.
- `design.popularity.ts`: after every import, each candidate gets a 0-100
  popularity score: 0.45 x likes percentile + 0.25 x views percentile + 0.30 x
  like-velocity percentile (likes per month since publication), ranked within
  its suggested type. The sources do not expose download counts.

Rows are upserted by `(store, source, sourceId)`, so the same model can be a
candidate of both stores. A re-import refreshes metadata, stats, and scores
but never changes `status`, `productId`, or the review fields. Only one run
executes at a time; the summary of the current or last run (fetched, new,
updated, skipped by reason, failed requests, and fetched models and failed
requests per source) is kept in memory until the API restarts.

## Import by link

`design.url.ts` recognizes model links and reduces them to a canonical URL and
source id: Sketchfab (`/3d-models/...-<uid>`, `/models/<uid>`), Thingiverse
(`/thing:<id>`), Printables (`/model/<id>-...`), and MyMiniFactory
(`/object/...-<id>`). Other links answer `400`.

- Sketchfab and Thingiverse models are read from their API with their license.
  Thingiverse links need `THINGIVERSE_API_TOKEN` (`503` otherwise); a failed
  read answers `502`.
- Printables and MyMiniFactory have no license data to read. Staff choose the
  `license` shown on the model page (`400` when missing or not accepted by the
  store). The API reads the page title, description, picture, and author from
  its Open Graph tags (10 s timeout, only these hosts). Staff-provided
  `title`, `authorName`, `authorUrl`, `previewUrl`, and `description` win;
  when the page cannot be read, `title` and `authorName` are required (`400`).

Imported links skip the relevance threshold, but the license, download,
age-restriction, and IP checks still apply. An existing candidate of the same
store and model is refreshed.

## Routes

- `GET /api/design-candidates`: paginated list of one
  store (`store`, `gripr` by default). Filters: `status`
  (`candidate` by default, `approved`, `rejected`), `type` (suggested type),
  `license` (`cc0`, `cc_by`, `cc_by_sa`, `cc_by_nd`), `ipRisk`, and `q`
  (title, author, tags). `sort` is `score` (default), `likes`, or
  `newest`. Candidates with `ipRisk=blocked`
  are listed only when that filter is requested.
- `GET /api/design-candidates/:id`: full details with the license name and URL,
  whether attribution is required, ShareAlike and derivative terms, the
  Sketchfab embed URL (`null` for other sources), and IP matches.
- `POST /api/design-candidates/:id/approve` with
  `{ "type", "acknowledgeIpRisk"? }`: creates a draft product (name = model
  title, slug = transliterated title plus the first six characters of the
  source id, chosen type, `basePrice` 0), copies the preview image to the
  Cloudinary `products` folder as its first image, and links the candidate.
  Returns the admin product. Answers `409` unless the candidate is in the
  `candidate` status, and for `blocked` IP risk unless `acknowledgeIpRisk` is
  `true`. The type must belong to the candidate's store (`400` otherwise). A
  failed preview copy is logged and the product is created without an image.
- `POST /api/design-candidates/:id/reject`: `candidate` to `rejected`.
- `POST /api/design-candidates/:id/restore`: back to `candidate` from
  `rejected`, or from `approved` when the linked product was deleted.
- `POST /api/design-candidates/import-url` with `{ "url", "store"?, "license"?,
  "title"?, "authorName"?, "authorUrl"?, "previewUrl"?, "description"? }`:
  imports one model by link (see above) and answers `200` with the admin
  candidate.
- `POST /api/design-candidates/import`: starts a run and answers `202` with its
  summary, or `409` while a run is in progress.
- `GET /api/design-candidates/import/status`: `running`, `enabled`,
  `thingiverseEnabled`, and the
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
