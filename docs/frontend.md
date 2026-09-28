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
| Orders | `GET /customers/me/orders`, `GET /customers/me/orders/:id`, `POST /customers/me/orders/:id/cancel`, `POST .../:id/model/approve`, `POST .../:id/model/request-changes`, `GET` and `POST .../:id/messages` |
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
| Order actions | `PATCH /orders/:id/status`, `PATCH /orders/:id/delivery` (TTN), `PATCH /orders/:id` (internal note), `POST /orders/:id/payments` (manual payment) |
| Production | `GET`, `POST`, `PATCH`, `DELETE /production-stages[/:id]`; `POST /orders/:orderId/items/:itemId/production-steps`, `PUT .../production-steps/order`, `PATCH` or `DELETE /production-steps/:id`; photos with `folder: "production"` |
| Custom requests | `GET /custom-requests?status=&source=`, `GET /custom-requests/:id`, `PATCH /custom-requests/:id`, `POST /custom-requests/:id/proposals` |
| Messages | `GET` and `POST /orders/:id/messages`, `GET` and `POST /custom-requests/:id/messages`; attachments with `folder: "messages"` |
| Customers | `GET /customers?q=`, `GET /customers/:id` |
| Open designs | `GET /design-candidates?status=&type=&license=&ipRisk=&q=&sort=`, `GET /design-candidates/:id`, `POST /design-candidates/:id/approve`, `POST .../:id/reject`, `POST .../:id/restore`, `POST /design-candidates/import`, `GET /design-candidates/import/status` |

Admin workflow notes:

- **Publishing:** create the product as `draft`, add images and options,
  preview it, then set `status: "published"`. Archive instead of deleting.
- **Open designs:** approving a candidate returns a draft product; open its
  editor to set the price (publishing with a zero price answers `409`). Show
  the product's `designCredit` read-only in the editor.
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
