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
   `stone` with `gemstone`, `stoneCarat`, and `stoneSizeMm`, `size` as a ring
   size picker (`ringSize`), `engraving` as a text field (up to 40
   characters), `custom` as a select. Preselect `isDefault` values. Show
   `priceDelta` as "+N ₴" next to a value when it is not zero.
2. On every change, call
   `POST /storefront/products/:slug/quote` with
   `{ "optionValueIds": [...], "engravingText": "..." }` (debounce around
   250 ms and ignore out-of-date responses). Show `unitPrice` and
   "виготовлення productionDaysMin–productionDaysMax днів". A `400` means the
   selection is invalid; show the message.
3. Switch the gallery to images whose `optionValueId` is selected, falling back
   to images without `optionValueId`.
4. For `inStock` products, show "в наявності" instead of the production time
   label if it fits your design.
5. Offer a size guide that links to the profile ring size
   (`GET /customers/me`, `ringSize`) to preselect the matching size value.

For sets, show `setPrice` and `setPriceDiscounted` and an "add the whole set"
button that calls `POST /customers/me/cart/sets/:collectionSlug`.

## Customer screens (signed in)

| Screen | Calls |
| --- | --- |
| Favorites | `GET /customers/me/favorites`, `PUT` or `DELETE /customers/me/favorites/:productId` |
| Cart | `GET /customers/me/cart`, `POST /customers/me/cart/items`, `PATCH` or `DELETE /customers/me/cart/items/:itemId`, `DELETE /customers/me/cart` |
| Profile | `GET` and `PATCH /customers/me` |
| Orders | `GET /customers/me/orders`, `GET /customers/me/orders/:id`, `POST /customers/me/orders/:id/cancel` |
| Custom request | `POST /customers/me/uploads/signature`, `POST /customers/me/custom-requests`, `GET /customers/me/custom-requests[/:id]`, `POST .../:id/accept`, `POST .../:id/decline` |

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
   `null`. For custom orders the first payment is the deposit
   (`type: "deposit"`) and a later one is the remainder.

### Order page and production timeline

Show:

- the status (`pending_payment`, `paid`, `in_production`, `ready`,
  `shipped`, `delivered`, `completed`, `cancelled`, `refunded`) with the
  `history` notes;
- for every item, `productionSteps` as a timeline: `stage.name`,
  `stage.description`, `state` (`pending`, `in_progress`, `done`,
  `skipped`), dates, the note, and photos;
- the Nova Poshta `trackingNumber` once shipped, linked to
  `https://novaposhta.ua/tracking/?cargo_number={trackingNumber}`;
- payments and `nextPayment`;
- a cancel button only while the status is `pending_payment`.

### Custom request

1. Upload reference images: `POST /customers/me/uploads/signature`, then POST
   each file to Cloudinary (see [Image uploads](#image-uploads)).
2. Submit `POST /customers/me/custom-requests` with `productType`,
   `description`, `referenceImages`, and optional `budgetMin`, `budgetMax`
   (kopiykas), `desiredMetal`, and `ringSize`.
3. The request list shows the status. When it is `quoted`, show `quote`
   (title, price, deposit, production days, note) with "accept" and
   "decline" actions.
4. Accepting asks for contact and delivery like checkout and calls
   `POST /customers/me/custom-requests/:id/accept`; then start the deposit
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
| Metals, gemstones, tags | `GET`, `POST /metals`, `PATCH`, `DELETE /metals/:id` (same for `/gemstones`, `/tags`) |
| Collections | `GET /collections?status=`, `GET`, `POST`, `PATCH`, `DELETE /collections[/:id]`; cover and gallery via `POST /media/upload-signature` with `folder: "collections"` |
| Products list | `GET /products?status=&collectionId=&type=&q=` |
| Product editor | `GET`, `POST`, `PATCH`, `DELETE /products[/:id]` |
| Product images | `POST /products/:id/images`, `PATCH` or `DELETE /products/:id/images/:imageId`, `PUT /products/:id/images/order`; upload with `folder: "products"` |
| Product options | `POST /products/:id/option-groups`, `PATCH` or `DELETE .../option-groups/:groupId`, `POST .../option-groups/:groupId/values`, `PATCH` or `DELETE .../values/:valueId` |
| Orders | `GET /orders?status=&kind=&createdFrom=&createdTo=&q=`, `GET /orders/:id` |
| Order actions | `PATCH /orders/:id/status`, `PATCH /orders/:id/delivery` (TTN), `PATCH /orders/:id` (internal note), `POST /orders/:id/payments` (manual payment) |
| Production | `GET`, `POST`, `PATCH`, `DELETE /production-stages[/:id]`; `POST /orders/:orderId/items/:itemId/production-steps`, `PATCH` or `DELETE /production-steps/:id`; photos with `folder: "production"` |
| Custom requests | `GET /custom-requests?status=`, `GET /custom-requests/:id`, `PATCH /custom-requests/:id`, `POST /custom-requests/:id/quote` |
| Customers | `GET /customers?q=`, `GET /customers/:id` |

Admin workflow notes:

- **Publishing:** create the product as `draft`, add images and options,
  preview it, then set `status: "published"`. Archive instead of deleting.
- **Configurator setup:** create one group per choice (for example "Метал",
  "Камінь", "Розмір", "Гравіювання"), add values with `priceDelta` and
  `productionDaysDelta`, and mark one default per required group. Link images
  to metal values with `optionValueId`.
- **Order status:** offer only the statuses in `allowedTransitions`. Before
  `shipped`, set the TTN; the order must be fully paid.
- **Production:** when an order is paid, apply the default template to each
  item (`POST .../production-steps` with `{}`); it includes 3D modeling,
  model approval, and a plastic fitting print for custom orders. Move steps as
  work progresses, attach photos, and hide internal steps with
  `visibleToCustomer: false`. Move the order to `in_production` and later
  `ready`.
- **Custom requests:** set `in_review`, then send a quote with price,
  optional deposit, and production days. The customer accepts it and pays the
  deposit.
