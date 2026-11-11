# Prints module

Gripr Lab resin printing: resins, printers, the print pricing settings, the
print calculator that prices
[print-priced Lab products](catalog.md#print-pricing) and one-off pieces,
the [model files](#model-files) customers and staff upload, and
[print requests](#print-requests) for printing customers' own models.
Resins and printers are Lab only and have no `store` column. Money is in
kopiykas and rates are fractions (`0.06` = 6%).

## Print calculator

`src/modules/prints/print.pricing.ts` is a pure implementation, unit tested
with the example of the [Lab plan](../lab.plan.md). It prices one piece on
a shared plate; the printers run 24/7 and print many pieces at once, so
printer time, electricity, wear, film, and consumables are divided by the
pieces that fit on the plate. For a model of `volumeMl` and `sizeMm` at
the reference size and a scale `s` (`heightMm / sizeMm.z` or the scale
factor):

```text
piecesPerPlate = max(1, floor(buildX × buildY × plateFillRate
                 / ((x·s + spacing) × (y·s + spacing))))
plateShare     = overrides.plateShare ?? 1 / piecesPerPlate
resinMl        = overrides.resinMl × s³
                 ?? volumeMl × s³ × (1 + supportRate) × (1 + wasteRate)
resin          = resinMl × density / 1000 × pricePerKg
layers         = ceil(z·s / layerHeight)
printHours     = overrides.printHours × s
                 ?? (bottom layers × bottom seconds + other layers
                 × secondsPerLayer) / 3600 + fixedMinutes / 60
electricity    = printHours × plateShare × electricityPerHour
wear           = printHours × plateShare × costs.wearPerHour
film           = layers × costs.filmPerLayer × plateShare
consumables    = consumables per plate × plateShare
failure        = (resin + electricity + wear + film) × failureRate
work           = postProcessingMinutes[finish] / 60 × work.hourlyRate
fixed          = fixedCosts.monthly / expectedPiecesPerMonth
cost           = all of the above + extras (e.g. a base)
unpainted      = cost × (1 + markupRate) / (1 − taxRate − paymentFeeRate),
                 rounded up to roundingStep
unitPrice      = unpainted × paintingMultiplier
```

A piece that does not fit the build volume (turned on the plate if needed)
gets `fitsPrinter: false` and the whole plate. The calculator uses the
default printer (else the first active one); `print.context.ts` loads the
settings, the printer with its costs at the current USD rate, and the resins
once per request.

- `POST /api/print-pricing/calculate` (admin): one-off pieces, e.g. a
  customer's model: `volumeMl`, `sizeMm`, `heightMm` or `scaleFactor`,
  `resinId` and `printerId` (defaults), `finish` (`supports_removed`),
  `paintingMultiplier`, `extras`, `quantity`, and `overrides`. Returns the
  printer, resin, `usdRate`, the `calculation` with every cost line,
  `total`, and the production days of the settings.
- `POST /api/print-pricing/product-preview` (admin): an unsaved Lab product
  (`print`, `optionGroups` with Lab kinds and their print fields,
  `printerId`) priced for every combination (optional groups with and
  without a value, at most 500, `truncated` beyond), with `priceFrom` as
  the card would show it. Combinations that cannot be priced carry `error`.

Card prices (`price_from`) and the production days of print-priced products
are refreshed in the same transaction when a resin, printer, or the print
settings change, and on every USD rate change.

## Resins

- `GET /api/resins` (admin): all resins, inactive included, by `sortOrder`
  then name.
- `POST /api/resins`, `PATCH /api/resins/:id`, `DELETE /api/resins/:id`
  (admin). A duplicate `code` returns 409, and so does deleting a resin that
  a product option value or a print request item uses (deactivate it
  instead).
- `GET /api/storefront/resins` (public): active resins with `id` (sent as
  `resinId` in print and custom requests), `code`, `name`, `kind`, `colour`,
  `description`, and `isDefault`. The price per kg stays admin only.

| Field | Notes |
| --- | --- |
| `code` | Unique slug. |
| `name`, `colour`, `description` | Shown to customers. |
| `kind` | `standard`, `abs_like`, `tough`, `water_washable`, `flexible`, `castable`, `clear`, `other`. |
| `densityGPerMl` | 0.5 to 3; converts millilitres to grams. |
| `pricePerKg` | Kopiykas. |
| `isDefault` | The resin used when the customer chooses nothing. |
| `isActive`, `sortOrder` | |

## Printers

- `GET /api/printers`, `GET /api/printers/:id` (admin).
- `POST /api/printers`, `PATCH /api/printers/:id`, `DELETE /api/printers/:id`
  (admin). A duplicate `code` returns 409.

A printer has its build volume (`buildXMm`, `buildYMm`, `buildZMm`), layer
timing (`layerHeightMm`, `secondsPerLayer`, `bottomLayers`,
`bottomLayerSeconds`, `fixedMinutes`), and plate packing (`plateFillRate`,
0.05 to 1, the share of the plate area pieces can use; `spacingMm`, the gap
around every piece).

Purchase prices (`price`, `lcdPrice`, `filmPrice`) are in minor units of
`costCurrency`: kopiykas for `UAH`, cents for `USD`. Their lifetimes are
`lifetimeHours`, `lcdLifetimeHours`, and `layersPerFilm`.
`electricityPerHour` is always kopiykas per printing hour.

Every response adds `usdRate` (UAH per USD: the manual rate, else the NBU
rate, else the pricing settings rate; see
[pricing](pricing.md#market-rates)) and `costs` in kopiykas:

- `price`, `lcdPrice`, `filmPrice`: the purchase prices converted to UAH;
- `wearPerHour`: `price / lifetimeHours + lcdPrice / lcdLifetimeHours`;
- `filmPerLayer`: `filmPrice / layersPerFilm`.

A zero lifetime counts as no wear. USD prices follow the rate, so parts
bought on the Elegoo site stay correct when the rate moves.

## Defaults

Creating or updating a resin or printer with `isDefault: true` clears the
flag on the others in the same transaction, so there is at most one default
of each. The seed adds the `abs-like-grey` resin (700 UAH per kg, density
1.10) and the `saturn-4-ultra-16k` printer (Elegoo Saturn 4 Ultra 16K, 563
USD, LCD 141 USD for 2 000 hours, film 6 USD for 60 000 layers) and marks
them default only when no default exists yet.

## Print settings

- `GET /api/print-settings` (admin): the stored settings merged over the
  code defaults (`src/modules/prints/print.settings.ts`), so new parameters
  get a value.
- `PUT /api/print-settings` (admin) replaces them. `productionDaysMin`
  greater than `productionDaysMax` or duplicate base codes return 400.

| Group | Fields (defaults) |
| --- | --- |
| `material` | `supportRate` 0.2, `wasteRate` 0.05, `failureRate` 0.1 |
| `consumables` | List of `{ name, packPrice, packSize, perPlate, unit }`; one plate costs `packPrice / packSize × perPlate` per line. Defaults: gloves, isopropyl alcohol, paper towels, respirator filters, 20 UAH per plate in total. |
| `work` | `hourlyRate` 5 000, `postProcessingMinutes` per finish: `raw` 5, `supports_removed` 20, `sanded` 45 |
| `painting` | Suggested multipliers for new `painting` option values: `painted` 2, `complex` 3; each value stores its own `paintingMultiplier` |
| `modeling` | `hourlyRate` 50 000, `freeBigRevisions` 1, `freeSmallRevisions` 2, `bigRevisionPrice` 100 000, `smallRevisionPrice` 25 000 |
| `fixedCosts` | `monthly` 500 000, `expectedPiecesPerMonth` 500 |
| `price` | `markupRate` 0.5, `taxRate` 0.06, `paymentFeeRate` 0.015, `roundingStep` 1 000, `productionDaysMin` 2, `productionDaysMax` 3 |
| `bases` | Bases offered for [print requests](#print-requests): `{ code, name, price }`, `code` of `a-z`, `0-9`, and `-`; none by default. Omitting it on `PUT` keeps none. |

Catalog products do not use `bases`: a `base` option value carries its cost
in `priceDelta`, added to the cost before the markup.

## Model files

Customers upload models for custom prints and modeling requests, staff
upload the model of a Lab product and the finished file of a
[modeling order](orders.md#gripr-lab-modeling). Files live in the private
Supabase Storage bucket `lab-models` (see
[architecture](../architecture.md#supabase)): customer files under
`customers/<userId>/<fileId>.<ext>`, product files under
`products/<productId>/<fileId>.<ext>`, and delivered files under
`deliverables/<orderId>/<fileId>.<ext>`. Rows are in `print_files`, owned by
at most one customer, product, or order. All upload and download routes
answer `503` when `SUPABASE_SECRET_KEY` is not set.

### Upload flow

1. Ask for an upload with `{ "fileName", "sizeBytes" }`. The extension must be
   STL, OBJ, 3MF, ZIP, or STEP (`400` otherwise) and the size at most 50 MB
   (`400`; send a ZIP or 3MF when an STL is larger). The answer (`201`) holds
   the `file` (status `uploading`), `uploadUrl`, `uploadToken`, and
   `storagePath`; the signed URL is valid for two hours.
2. The browser uploads the bytes to Storage directly (`PUT uploadUrl`, or
   `uploadToSignedUrl(storagePath, uploadToken, file)` from supabase-js).
3. Confirm with `POST .../:id/complete` (`200`). The API reads the stored
   size: nothing stored yet answers `409`, more than 50 MB deletes the object
   and marks the file `failed`. STEP files become `manual`; the others become
   `analyzing` and are measured in the background. Completing twice answers
   `409`.
4. Poll the file until `status` is `analyzed`, `manual`, or `failed`
   (`error` says why).

### Routes

Customer (`/api/customers/me/print-files`, own files only, `404` for others):

- `POST /`: start an upload.
- `POST /:id/complete`: confirm the upload.
- `GET /:id`: status and measurements.
- `DELETE /:id` (`204`): deletes the row and the stored object; `409` while
  the file is in a print request that is not cancelled or rejected, or is the
  source file of a Gripr Lab [custom request](custom.requests.md#gripr-lab-modeling)
  that is open or accepted into an order that is not closed.

Delivered files of an order are uploaded and downloaded through the
[order routes](orders.md#gripr-lab-modeling).

Admin (`/api/print-files`):

- `POST /` with `{ "productId", "fileName", "sizeBytes" }`: start a staff
  upload for a Lab product (`404` unknown product, `400` Gripr product).
- `GET /?productId=`: the product's files, newest first.
- `GET /:id`: any file, with `customerId`, `productId`, and `orderId`.
- `POST /:id/complete`: confirm a staff upload.
- `PATCH /:id/measurements` with `{ "volumeMl", "sizeMm" }`: staff
  measurements of a `manual` file (`409` for other statuses).
- `GET /:id/download`: `{ url, expiresAt }`, a signed download URL valid for
  10 minutes (`409` while uploading).
- `DELETE /:id` (`204`): `409` while a product takes its print size from it.

### Measurements

`src/modules/prints/mesh/` holds pure parsers over a `Buffer`, unit tested
with in-memory fixtures:

- STL, binary or ASCII; OBJ (polygons split into triangle fans, negative
  indices supported); 3MF (every mesh object of every `.model` part in its
  declared unit, converted to millimetres; build transforms and repeated
  copies are ignored); ZIP (every STL, OBJ, and 3MF inside as a separate
  part, other files skipped).
- `volumeMl` is the sum of signed tetrahedra (exact for closed meshes),
  `sizeMm` the bounding box (the largest extent per axis over all parts),
  `isWatertight` whether every edge is shared by exactly two triangles, and
  `units` the 3MF unit (`null` for STL and OBJ, which have none; millimetres
  are assumed).
- `warnings`: `not_watertight` (the volume is rough), `multiple_parts`,
  `small_model` (no units and the largest side under 5, maybe centimetres or
  inches), and `exceeds_build_volume` (does not fit the default printer in any
  axis-aligned orientation; staff can split it).
- Limits: at most 5 million triangles; ZIP and 3MF archives at most 50
  entries, 300 MB unpacked, a compression ratio of at most 100 per entry, no
  encrypted or ZIP64 archives, and no paths outside the archive. Inflating
  never produces more than the declared size.
- `MeshAnalyzer` runs the parsers in a worker thread with a 60-second and
  1 GB limit and turns any failure into a `failed` file with a readable
  `error`.

### Product models

A Lab product's `print` takes `printFileId`: a measured file of that product
(`analyzed`, or `manual` with staff measurements). Saving the product copies
the file's `volumeMl` and `sizeMm` into `print`, so `volumeMl` and `sizeMm`
may be omitted. The file must belong to the product (`400`), so it is set when
updating a product, not when creating one. Measuring the file again does not
change the product until it is saved again.

### Cleanup

A nightly job (03:30 Europe/Kyiv) deletes uploads still `uploading` after 24
hours, customer files after 30 days, and files whose customer, product, or
order was deleted (the row keeps no owner), together with their stored
objects. Delivered files stay with their order. It also marks files
`analyzing` for more than an hour (interrupted by a restart) as `failed`. A
customer file older than 30 days stays while a print request needs it:
requests being reviewed, confirmed, or in the cart; ordered requests until
their order is closed (delivered, completed, cancelled, or refunded) and
unchanged for 30 days; and drafts, rejected, and cancelled requests changed
in the last 30 days. The same holds for the source file of a Gripr Lab
custom request (or one of its proposals): it stays while the request is
open, while its order is not closed, and for 30 days after either last
changed.

## Print requests

Customers ask the Lab to print their own [model files](#model-files). A
request holds up to 20 items, one per model, with the customer's choices; the
API estimates it with the [print calculator](#print-calculator), staff adjust
the calculation and confirm a price, and the customer pays for it through the
Lab [cart](cart.md#lab-prints). Rows are in `print_requests` and
`print_request_items`; each request has its own
[conversation](messages.md).

### Statuses

| From | To |
| --- | --- |
| `draft` | `submitted`, `cancelled` |
| `submitted` | `in_review`, `cancelled` |
| `in_review` | `confirmed`, `changes_requested`, `rejected` |
| `changes_requested` | `submitted`, `cancelled` |
| `confirmed` | `in_cart`, `cancelled`, `in_review` (price expired) |
| `in_cart` | `confirmed` (taken out), `ordered`, `in_review` (price expired) |
| `ordered` | `cancelled` (with its order) |

- The customer edits `draft` and `changes_requested` requests and submits
  them. Submitting needs at least one item, `rightsConfirmed` (the customer may
  have the models printed), and every model uploaded and not `failed`
  (`400`); `manual` files wait for staff measurements.
- Staff edit `submitted` and `in_review` requests; any edit moves a submitted
  request to `in_review`. They confirm it, return it for changes, or reject
  it.
- A confirmed price is valid for 14 days (`priceValidUntil`). Adding an
  expired print to the cart answers `409`, and a nightly job (03:45
  Europe/Kyiv) returns expired `confirmed` and `in_cart` requests to
  `in_review` without a price.
- Checkout orders every `in_cart` print of the customer (`ordered`, with
  `orderId`); cancelling the order cancels its requests. An ordered request
  is not cancelled on its own (`409`).
- `rejected` and `cancelled` are final.

### Pricing an item

An item takes the model's measurements (`volumeMl`, `sizeMm`) and scales them
by `heightMm` (the printed height) or `scaleFactor` (not both, `400`); with
neither the file's size is printed. Then it is priced as one piece with:

- the chosen active resin, else the default resin;
- `finish` (`raw`, `supports_removed` by default, `sanded`);
- painting: the staff `paintingMultiplier`, else `painting.painted` of the
  settings when `painted`, else none;
- the price of the chosen base from the settings, added to the cost; the base
  is stored as a snapshot, so later settings changes do not alter it;
- the staff printer, else the default printer;
- the staff `overrides`, values at the printed size (`resinMl`,
  `printHours`, `supportRate`, `plateShare`).

An item without a price has `unitPrice: null` and `priceError`: the file is
still measured, failed, deleted, or `manual` without staff measurements; the
resin is inactive; or no printer is set up. The `estimate` is the sum of
`lineTotal` while every item has one, else `null`. Items are priced again on
every customer change, on submit, on every staff edit, and on confirm.

### Routes

Public:

- `GET /api/storefront/print-options`: `bases` (`code` and `name`, no
  prices), `finishes`, `maxFileBytes`, `maxItems`, `maxQuantity`, and
  `priceValidDays`.

Customer (`/api/customers/me/print-requests`, own requests only, `404` for
others):

- `POST /` with `{ "comment"?, "rightsConfirmed"?, "items"? }` (`201`):
  a draft. Items are `{ "fileId", "quantity"? (1 to 50), "heightMm"?,
  "scaleFactor"?, "resinId"?, "finish"?, "painted"?, "baseCode"? }`; files
  must be the customer's own and bases and resins must exist (`400`).
- `GET /` (paginated, newest submitted first) and `GET /:id`.
- `POST /quote` with `{ "items" }` (`200`): prices items without saving them:
  `unitPrice`, `lineTotal`, `priceError`, the printed `sizeMm`, and
  `fitsPrinter` per item, and the `estimate`.
- `PATCH /:id`: `comment`, `rightsConfirmed`, and `items` (replaces all
  items); `409` outside `draft` and `changes_requested`.
- `POST /:id/submit`, `POST /:id/cancel`.
- `POST /:id/cart`: `confirmed` to `in_cart`; `DELETE /:id/cart` takes it
  out again.

Customers see the prices, the resin, the base name, and the printed size, not
the calculation.

Admin (`/api/print-requests`):

- `GET /?status=` (paginated; drafts only with `status=draft`) and
  `GET /:id`: with `customerId` and per item `printerId`,
  `paintingMultiplier`, `overrides`, `basePrice`, and the full `calculation`.
- `PATCH /:id` with `{ "staffNote"?, "productionDaysMin"?,
  "productionDaysMax"?, "items"? }`; items are `{ "id", "printerId"?,
  "paintingMultiplier"?, "overrides"? }`, where `null` returns to the
  calculated value. Unknown items or printers answer `400`.
- `POST /:id/confirm`: prices every item again and confirms the sum as
  `confirmedPrice`; `409` while an item has no price. Production days default
  to the print settings.
- `POST /:id/request-changes` and `POST /:id/reject` with `{ "note" }`: the
  note becomes `staffNote` and a staff message of the request's conversation.