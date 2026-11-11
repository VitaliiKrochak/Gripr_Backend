# Frontend integration guide

How the Next.js application (`../Gripr_frontend`) uses this API. The OpenAPI
document at `/api/docs-json` is the exact contract; keep the frontend types in
sync with it.

The frontend serves Ukrainian (default) and English under a language prefix
(`/uk/...`, `/en/...`). Paths without a prefix, including the LiqPay return
URL, are redirected by the frontend proxy to the visitor's language, so
`LIQPAY_RESULT_URL` stays `https://<site>/checkout/result`.

## Ground rules

- Browser code calls the same-origin Next.js BFF. The BFF forwards requests to
  NestJS (`https://<api>/api/...`) with the Supabase access token in the
  `access_token` cookie. Never send the refresh token to NestJS.
- The BFF owns Supabase sign-in, refresh, and sign-out and the `HttpOnly`
  cookies. Refresh the session before forwarding when the access token is about
  to expire; a `401` from NestJS means the session is missing or invalid.
- `403` from NestJS is final (for example a non-admin calling an admin
  route). Admin pages may check `app_metadata.role` to decide what to render,
  but that check is not security.
- Money is always an integer number of kopiykas. Format it for display only:
  `new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' })
  .format(amount / 100)`.
- Never compute prices on the client. Show the prices the API returns and call
  the quote endpoint whenever the configuration changes.
- Lists are paginated with `page` (from 1) and `pageSize` (up to 100) and
  return `{ items, total, page, pageSize }`.
- Errors use the NestJS format
  `{ "statusCode": 400, "message": "..." | ["..."], "error": "Bad Request" }`.
  Validation errors return an array of messages. `409` means the action
  conflicts with the current state (stock changed, status does not allow it);
  reload the resource and show the message.
- Images are Cloudinary URLs. Use Cloudinary transformations in the URL for
  responsive sizes.

## Sign-in

1. Phone screen: normalize input to `+380XXXXXXXXX` and call Supabase
   `signInWithOtp({ phone })` from the BFF. Supabase calls this API's hook,
   which sends the code by Telegram, or by Viber/SMS if the number has no
   Telegram. A hook error message (for example "Only Ukrainian phone numbers
   (+380) are supported") is returned as the Supabase error; show it.
2. Code screen: call `verifyOtp({ phone, token, type: 'sms' })` in the BFF and
   set the session cookies. Tell the user to look for the code in Telegram
   first, then Viber or SMS. Allow resending after the Supabase rate limit.
3. After sign-in, `GET /customers/me` returns the profile (created on first
   call).

## Gripr and Gripr Lab

The API serves two [stores](architecture.md#stores). Store-scoped calls take
`?store=gripr` or `?store=lab` and use `gripr` when it is omitted, so the
Gripr screens below work unchanged. For Lab screens pass `store=lab` to:

- every `/storefront/*` call (product and collection pages of the other
  store answer `404`);
- `GET` and `DELETE /customers/me/cart`, `GET /customers/me/favorites`,
  `GET /customers/me/orders`, and the checkout body
  (`POST /customers/me/orders` with `"store": "lab"`);
- admin lists: `/dashboard/summary`, `/products`, `/collections`, `/tags`,
  `/orders`, `/production-stages`, `/custom-requests`, `/design-candidates`,
  and the `store` field when creating a collection, tag, or production stage.

Cart mutations return the cart of the changed line's store. Show orders by
their `reference` (`GR-1042`, `LAB-1043`). Lab orders are paid the same way
as Gripr orders (into the Lab LiqPay shop); `409` means the Lab shop is not
configured on this server.

Lab-only screens ([prints](modules/prints.md)):

- Admin "Resins" and "Printers" tables with create, edit, and delete, at
  `/resins` and `/printers`. A printer form takes purchase prices in the
  chosen `costCurrency` (cents for USD); show `costs` (UAH, at `usdRate`)
  next to them. Only one resin and one printer can be the default.
- Admin "Print settings" form at `GET|PUT /print-settings`: material rates,
  the consumables list, work, painting multipliers, modeling, fixed costs,
  price, and the `bases` offered for print requests. Rates are fractions;
  show them as percents.
- The storefront resin picker and resin badges use
  `GET /storefront/resins` (no prices).
- The Lab product editor has a "Print" section instead of the jewelry
  calculator: `print` with `mode`, `volumeMl`, `sizeMm`, and the slicer
  `overrides`; the option values of Lab kinds take `heightMm` or
  `scaleFactor`, `resinId`, `paintingMultiplier` (suggest 2 and 3 from the
  print settings), and `printFinish`. "Prices of every combination" uses
  `POST /print-pricing/product-preview` with the unsaved draft; a staff
  calculator for one-off pieces uses `POST /print-pricing/calculate`.
- The Lab product editor (existing products) uploads the staff model through
  [model uploads](#model-uploads) at `POST /print-files` with `productId`,
  lists them with `GET /print-files?productId=`, and offers "Use this model"
  once a file is `analyzed`: save `print` with `printFileId`; the server
  fills `volumeMl` and `sizeMm`. Show `warnings` and offer the download
  (`GET /print-files/:id/download`). STEP files are `manual`: ask for the
  volume and size (`PATCH /print-files/:id/measurements`).
- Lab product pages with `pricedPerSelection: true` must not add up
  `priceDelta` (it is 0): request
  `POST /storefront/products/:slug/quote?store=lab` on every option change
  and show its `unitPrice`. Show "від" with `priceFrom`, the resin name and
  type, and the production days; never resin amounts or print time.
- Admin "Print requests" queue at `GET /print-requests?status=` (submitted
  and in review first). The request screen shows each model with its
  `calculation` and file download, lets staff pick a printer, a painting
  multiplier, and slicer overrides (`PATCH /print-requests/:id`, values at the
  printed size; the response is the new calculation), and offers "Confirm"
  (`POST /print-requests/:id/confirm`), "Request changes", and "Reject" with
  a note, next to the conversation (`/print-requests/:id/messages`).
- Admin Lab custom requests (`GET /custom-requests?store=lab`): the proposal
  form takes a Lab specification (prefilled from the request) and
  `modelingHours`, shows the calculated model price from the response, and
  locks `productPrice` and `productionPrepayment` at 0 for a `file`
  deliverable. On a Lab modeling order with `modeling.pendingRevision`, ask
  staff to classify the requested changes as big or small
  (`POST /orders/:id/model/revisions`) before "Send for review"; a paid
  revision returns the order to model payment. Orders that deliver the file
  get a "Model files" panel: upload through [model uploads](#model-uploads)
  at `POST /orders/:id/files` and list `GET /orders/:id/files`.

## Print your model

The Lab "Print your model" flow ([print requests](modules/prints.md#print-requests)):

1. Load `GET /storefront/print-options` and `GET /storefront/resins` for the
   choices and limits.
2. Upload models through [model uploads](#model-uploads). While the customer
   chooses a height or scale, resin, finish, painting, and base per model,
   call `POST /customers/me/print-requests/quote` (debounced) and show each
   `unitPrice` or `priceError`, the printed `sizeMm`, and a warning when
   `fitsPrinter` is `false` (staff split the model). Label the sum as an
   estimate.
3. Save the request (`POST` or `PATCH /customers/me/print-requests`), ask the
   customer to confirm they may have the models printed (`rightsConfirmed`),
   and submit it (`POST .../:id/submit`).
4. "My print requests" lists `GET /customers/me/print-requests` with the
   status, `staffNote` for returned or rejected requests, and the
   conversation. A `confirmed` request shows `confirmedPrice` and
   `priceValidUntil` with "Add to cart" (`POST .../:id/cart`; `409` means
   the price expired and the Lab checks it again).
5. The Lab cart shows `prints` next to `items`: models, prices, and options,
   with "Remove" (`DELETE .../:id/cart`) but no quantity or option edits.
   Order items with `itemKind: "print"` link to their request through
   `printRequestId`.

## Order a model

The Lab "Order a model" flow ([Gripr Lab modeling](modules/custom.requests.md#gripr-lab-modeling)):

1. Ask what to deliver (a printed piece, the model file, or both), the
   height, and for printed pieces the resin, finish, painting, base, and
   quantity (choices from `GET /storefront/print-options` and
   `GET /storefront/resins`). Optionally upload the customer's own model
   through [model uploads](#model-uploads) as the source file, and reference
   images as in [Custom request](#custom-request).
2. Submit `POST /customers/me/custom-requests` with `store: "lab"`, a print
   `productType`, `description`, `referenceImages`, and `labSpecification`
   (`deliverable`, `heightMm`, `resinId`, `finish`, `painted`, `baseCode`,
   `quantity`, `sourceFileId`, `comments`). List them with
   `GET /customers/me/custom-requests`.
3. The proposal shows the model price, the print price (none for a file),
   the included revisions from `revisionTerms` ("1 big and 2 small revisions
   included; then 1 000 and 250 UAH"), and the production days. Accepting
   works as for jewelry.
4. The order page shows the model and print items, `modeling.freeBigRevisionsLeft`
   and `freeSmallRevisionsLeft`, and, when the deliverable includes the file,
   the files from `GET /customers/me/orders/:id/files`. "Download" calls
   `GET /customers/me/orders/:id/files/:fileId` and shows the returned
   `license` next to the link; `409` means the model is not approved or the
   order is not fully paid yet. A file-only order is `completed` once the
   model is approved.

## Storefront screens

| Screen | Calls |
| --- | --- |
| Home | `GET /storefront/home` |
| Catalog | `GET /storefront/filters` once, then `GET /storefront/products?...` on every filter, sort, or page change |
| Product | `GET /storefront/products/:slug`, `GET /storefront/products/:slug/recommendations?limit=8` |
| Collection or set | `GET /storefront/collections`, `GET /storefront/collections/:slug` |

Catalog filters map to query parameters: `collection`, `tags`, `metals`,
`gemstones` (comma-separated), `type`, `priceMin`, `priceMax` (kopiykas),
`inStock`, `hot`, `new`, `q`, and `sort` (`featured`, `newest`, `price_asc`,
`price_desc`). Keep them in the page URL so results can be shared.

### Product configurator

The product response contains `optionGroups` with only available values, and
`defaultQuote` for the default selection.

1. Render each group by `kind`: `metal` as swatches (value `metal.color`),
   `stone` with `gemstone`, `stoneCarat`, and `stoneSizeMm`, `size` as a size
   picker (`sizeValue`: ring size for rings, length in cm for chains,
   necklaces, and bracelets), `engraving` as a text field (up to 40
   characters), `coating` and `processing` with `finishing`, `custom` as a
   select. Preselect `isDefault` values. Show `priceDelta` as "+N ₴" next to
   a value when it is not zero.
2. On every change, call
   `POST /storefront/products/:slug/quote` with
   `{ "optionValueIds": [...], "engravingText": "..." }` (debounce around
   250 ms and ignore out-of-date responses). Show `unitPrice`, optionally the
   `breakdown`, and "виготовлення productionDaysMin–productionDaysMax днів".
   A `400` means the selection is invalid; show the message.
3. Show `characteristics` (metals, weight, dimensions, stones, coatings) as
   the product's characteristics; `specifications` are extra manual rows.
4. Switch the gallery to images whose `optionValueId` is selected, falling back
   to images without `optionValueId`.
5. For `inStock` products, show "в наявності" instead of the production time
   label if it fits your design.
6. Offer "Request customization": a custom request with `productId` and the
   selected `optionValueIds` (see [Custom request](#custom-request)).
7. Offer a size guide that links to the profile ring size
   (`GET /customers/me`, `ringSize`) to preselect the matching size value.

When `designCredit` is not `null`, the product page must show a public license
section after the description: the model title, the author (linked to
`authorUrl`), the source link, and `licenseName` linked to `licenseUrl`. Product
listings already come ordered with these products after our own; do not
re-sort them on the client.

For sets, show `setPrice` and `setPriceDiscounted` and an "add the whole set"
button that calls `POST /customers/me/cart/sets/:collectionSlug`.

## Customer screens (signed in)

| Screen | Calls |
| --- | --- |
| Favorites | `GET /customers/me/favorites`, `PUT` or `DELETE /customers/me/favorites/:productId` |
| Cart | `GET /customers/me/cart`, `POST /customers/me/cart/items`, `PATCH` or `DELETE /customers/me/cart/items/:itemId`, `DELETE /customers/me/cart` |
| Profile | `GET` and `PATCH /customers/me` |
| Orders | `GET /customers/me/orders`, `GET /customers/me/orders/:id`, `POST /customers/me/orders/:id/cancel`, `POST .../:id/model/approve`, `POST .../:id/model/request-changes`, `GET` and `POST .../:id/messages`, `GET .../:id/files[/:fileId]` (Lab model files) |
| Custom request | `GET /storefront/reference`, `POST /customers/me/uploads/signature`, `POST /customers/me/custom-requests`, `GET /customers/me/custom-requests[/:id]`, `POST .../:id/accept`, `POST .../:id/request-changes`, `POST .../:id/decline`, `GET` and `POST .../:id/messages` |

Guests can browse and configure without signing in. Ask them to sign in when
they add to the cart or favorites, and replay the action afterwards.

### Cart

Every cart response is repriced. Lines with `unavailableReason` must be edited
or removed before checkout; disable the checkout button while
`hasUnavailableItems` is `true`. Show the set discount per line (`discount`)
and in the totals. The production estimate for the whole order is
`productionDaysMin`–`productionDaysMax`.

### Checkout

1. Prefill contact and delivery from the profile.
2. City picker: `GET /delivery/cities?q=` after two characters (debounced).
3. Branch picker: `GET /delivery/warehouses?cityRef=&q=`; show `name` and
   mark parcel lockers (`category: "Postomat"`).
4. Submit `POST /customers/me/orders` with `contactName`, optional
   `contactPhone`, `contactEmail` (the fiscal receipt is emailed there; ask
   for it and explain why), `delivery` (`cityRef`, `cityName`,
   `warehouseRef`, `warehouseName`), `comment`, and `saveAsDefault`.
   `409` means stock or availability changed: reload the cart.
5. Continue with payment using the returned order `id`.

### Payment with LiqPay

1. Call `POST /customers/me/orders/:orderId/payments`. The response contains
   `checkoutUrl`, `data`, `signature`, `type`, and `amount`.
2. Submit a form to LiqPay from the browser:

   ```html
   <form method="POST" action="{checkoutUrl}" accept-charset="utf-8">
     <input type="hidden" name="data" value="{data}" />
     <input type="hidden" name="signature" value="{signature}" />
   </form>
   ```

3. LiqPay returns the customer to `LIQPAY_RESULT_URL?orderId=...`
   (`/checkout/result`, redirected to `/<lang>/checkout/result`). The result
   page polls `GET /customers/me/orders/:orderId` every few seconds (up to about
   a minute) until `paidAmount` grows or `status` changes; the payment is
   confirmed by LiqPay's server callback, not by the redirect.
4. Show the "pay" button on the order page whenever `nextPayment` is not
   `null`. Legacy custom orders pay a deposit (`type: "deposit"`) and then the
   remainder; staged custom orders pay `model_prepayment`,
   `production_prepayment`, and `remainder` as their status reaches each
   stage (see [orders](modules/orders.md#staged-custom-orders)).

### Order page and production timeline

Show:

- the status (`pending_payment`, `awaiting_model_payment`, `modeling`,
  `model_review`, `awaiting_production_payment`, `paid`, `in_production`,
  `awaiting_final_payment`, `ready`, `shipped`, `delivered`, `completed`,
  `cancelled`, `refunded`) with the `history` notes, and for staged custom
  orders the payment stages with their amounts;
- in `model_review`, "approve the model" and "request changes" actions;
- the conversation (`messages`) with attachments;
- for every item, `productionSteps` as a timeline: `stage.name`,
  `stage.description`, `state` (`pending`, `in_progress`, `done`,
  `skipped`), dates, the note, and photos;
- the Nova Poshta `trackingNumber` once shipped, linked to
  `https://novaposhta.ua/tracking/?cargo_number={trackingNumber}`;
- payments and `nextPayment`;
- a cancel button only while the status is `pending_payment` or
  `awaiting_model_payment`.

### Custom request

1. Upload reference images: `POST /customers/me/uploads/signature`, then POST
   each file to Cloudinary (see [Image uploads](#image-uploads)).
2. Load choices from `GET /storefront/reference` and submit
   `POST /customers/me/custom-requests` with `productType`, `description`,
   `referenceImages`, optional `budgetMin`, `budgetMax` (kopiykas), and a
   `specification` (metal or recommendation, stone groups, "no stones" or
   recommendation, size by type, engraving, coating, timeline, comments,
   requirements; see [custom requests](modules/custom.requests.md)). For
   "Request customization" also send `productId` and `optionValueIds`.
3. The request page shows the original request separately from the latest
   `proposal` (specification, 3D model price, product price, production
   prepayment, production days, note) with "accept", "request changes", and
   "decline" actions; earlier `proposals` are history.
4. Accepting asks for contact and delivery like checkout and calls
   `POST /customers/me/custom-requests/:id/accept`; then start the first
   payment for the returned `orderId`.

## Image uploads

1. Get a signature (`POST /media/upload-signature` with a `folder` for admins,
   `POST /customers/me/uploads/signature` for customers).
2. Upload directly from the browser:

   ```ts
   const body = new FormData();
   body.append('file', file);
   body.append('api_key', signature.apiKey);
   body.append('timestamp', String(signature.timestamp));
   body.append('folder', signature.folder);
   body.append('signature', signature.signature);
   const uploaded = await fetch(signature.uploadUrl, { method: 'POST', body })
     .then((response) => response.json());
   ```

3. Send `{ publicId: uploaded.public_id, url: uploaded.secure_url, alt }` to
   the API. Signatures expire after about an hour; request a new one per
   upload session.

## Model uploads

Gripr Lab models (STL, OBJ, 3MF, ZIP, STEP) go to Supabase Storage, not
Cloudinary ([model files](modules/prints.md#model-files)):

1. Check the extension and that the file is at most 50 MB in the browser
   (suggest a ZIP or 3MF for bigger STLs), then call
   `POST /customers/me/print-files` with `{ fileName, sizeBytes }`.
2. Upload the bytes directly from the browser:

   ```ts
   await fetch(upload.uploadUrl, {
     method: 'PUT',
     headers: { 'content-type': file.type || 'application/octet-stream' },
     body: file,
   });
   ```

   or `supabase.storage.from('lab-models').uploadToSignedUrl(upload.storagePath, upload.uploadToken, file)`.
3. Call `POST /customers/me/print-files/:id/complete`, then poll
   `GET /customers/me/print-files/:id` every second or two while `status` is
   `analyzing`. Show `volumeMl`, `sizeMm`, and `warnings` when `analyzed`,
   `error` when `failed`, and "staff will measure it" when `manual`.
4. `503` means uploads are not set up on this server. The browser may
   measure the file itself for an instant preview, but prices always use the
   server's measurement.

## Admin panel

All admin routes require `app_metadata.role = "admin"`.

| Screen | Calls |
| --- | --- |
| Dashboard | `GET /dashboard/summary` |
| Metals, gemstones, finishing options, tags | `GET`, `POST /metals`, `PATCH`, `DELETE /metals/:id` (same for `/gemstones`, `/finishing-options`, `/tags`) |
| Collections | `GET /collections?status=`, `GET`, `POST`, `PATCH`, `DELETE /collections[/:id]` (with ordered `productIds`); cover and gallery via `POST /media/upload-signature` with `folder: "collections"` |
| Products list | `GET /products?status=&collectionId=&type=&q=` |
| Product editor | `GET`, `POST`, `PATCH`, `DELETE /products[/:id]` with `stones`, `optionGroups`, and `images` in one save |
| Product preview | `GET /products/:id/preview`, `POST /products/:id/preview/quote` (drafts included) |
| Product images | `POST /products/:id/images`, `PATCH` or `DELETE /products/:id/images/:imageId`, `PUT /products/:id/images/order`; upload with `folder: "products"` |
| Product options | `POST /products/:id/option-groups`, `PATCH` or `DELETE .../option-groups/:groupId`, `POST .../option-groups/:groupId/values`, `PATCH` or `DELETE .../values/:valueId` |
| Orders | `GET /orders?status=&kind=&createdFrom=&createdTo=&q=`, `GET /orders/:id` |
| Order actions | `PATCH /orders/:id/status`, `PATCH /orders/:id/delivery` (TTN), `PATCH /orders/:id` (internal note), `POST /orders/:id/payments` (manual payment), `POST /orders/:id/model/revisions` and `POST` or `GET /orders/:id/files` (Lab modeling) |
| Production | `GET`, `POST`, `PATCH`, `DELETE /production-stages[/:id]`; `POST /orders/:orderId/items/:itemId/production-steps`, `PUT .../production-steps/order`, `PATCH` or `DELETE /production-steps/:id`; photos with `folder: "production"` |
| Custom requests | `GET /custom-requests?store=&status=&source=`, `GET /custom-requests/:id`, `PATCH /custom-requests/:id`, `POST /custom-requests/:id/proposals` |
| Messages | `GET` and `POST /orders/:id/messages`, `GET` and `POST /custom-requests/:id/messages`; attachments with `folder: "messages"` |
| Customers | `GET /customers?q=`, `GET /customers/:id` |
| Open designs | `GET /design-candidates?store=&status=&type=&license=&ipRisk=&q=&sort=`, `GET /design-candidates/:id`, `POST /design-candidates/import-url`, `POST /design-candidates/:id/approve`, `POST .../:id/reject`, `POST .../:id/restore`, `POST /design-candidates/import`, `GET /design-candidates/import/status` |

Admin workflow notes:

- **Publishing:** create the product as `draft`, add images and options,
  preview it, then set `status: "published"`. Archive instead of deleting.
- **Open designs:** approving a candidate returns a draft product; open its
  editor to set the price (publishing with a zero price answers `409`). Show
  the product's `designCredit` read-only in the editor. The queue follows the
  admin store switch (`store`). An "Import by link" form posts the link; for
  Printables and MyMiniFactory links it also asks for the license (only the
  licenses of the current store) and, after a `400` about an unreadable page,
  the title and author. Show `shareAlike` ("share changes under the same
  license") and `derivativesAllowed: false` ("print unchanged, no remixes")
  on Lab candidates, and hide the Thingiverse source when the import status
  has `thingiverseEnabled: false`.
- **Configurator setup:** one editor with a single "Save product" button:
  manufacturing price, weight, stone groups, then one group per choice
  (metal, size, engraving, coating, processing, custom) with values ordered by
  drag and drop and one default per required group. Names and labels may be
  left empty to use generated ones. Link images to values with
  `optionValueId`.
- **Order status:** offer only the statuses in `allowedTransitions`. Before
  `shipped`, set the TTN; the order must be fully paid.
- **Production:** when an order is paid, apply the default template to each
  item (`POST .../production-steps` with `{}`); it includes 3D modeling,
  model approval, and a plastic fitting print for custom orders. Move steps as
  work progresses, attach photos, and hide internal steps with
  `visibleToCustomer: false`. Move the order to `in_production` and later
  `ready`.
- **Custom requests:** set `in_review`, then send a proposal with the final
  specification (prefilled from the request), 3D model price (or no model),
  product price, production prepayment, production days, and a note. The
  customer approves it or requests changes; send a new version for changes.
  After approval, move the order from `modeling` to `model_review` when the
  model is ready; payments advance the other stages.
