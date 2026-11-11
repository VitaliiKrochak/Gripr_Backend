# Architecture

The project uses a small feature-first structure. A feature keeps its module,
controllers, services, and DTOs together without empty architectural layers.
The Next.js frontend lives in the sibling `../Gripr_frontend` repository and exposes
a same-origin BFF between browser code and NestJS. The frontend integration
guide is [`frontend.md`](frontend.md).

```text
src/
  modules/                 # business features
    auth/                  # Supabase Send SMS hook (phone OTP delivery)
    customers/             # customer profile; admin customer list
    media/                 # signed Cloudinary uploads
    catalog/               # admin catalog: reference data, collections, products
    storefront/            # public catalog, configurator quote, recommendations
    favorites/
    cart/
    orders/                # checkout, order lifecycle, admin order management
    payments/              # LiqPay checkout and callback, manual payments
    production/            # production stages and per-item production steps
    custom.requests/       # custom requests, customizations, proposals
    messages/              # customer-workshop conversations per order/request
    delivery/              # Nova Poshta city and branch lookup
    dashboard/             # admin summary
    designs/               # open-license model import (both stores) and review queue
    pricing/               # price calculator, NBU rates, auto-priced products
    prints/                # Gripr Lab resins, printers, print settings, model files, print requests
      mesh/                # pure STL/OBJ/3MF/ZIP measurement and its worker thread
    health/
  shared/                  # reusable building blocks, no Nest modules
    decorators/
    errors/
    guards/
    media/
    origins/
    pagination/
    phone/
    specification/         # jewelry specification DTO (requests, proposals, orders)
    types/
  integrations/            # external systems
    cloudinary/
    database/              # Drizzle schema, client, and seed
    liqpay/
    nbu/                   # National Bank of Ukraine exchange rates
    novaposhta/
    sketchfab/             # public model search
    supabase/              # Auth token checks and Storage (model files)
    telegram/              # Telegram Gateway API
    thingiverse/           # thing search and details (app token)
    turbosms/              # Viber with SMS fallback
  swagger.ts               # OpenAPI setup and documentation access
  app.module.ts
  app.setup.ts
  main.ts
drizzle/                   # generated SQL migrations
drizzle.config.ts
```

Each directory has one responsibility:

- `modules` contains the application features and their Nest modules.
- `shared` contains small reusable decorators, guards, helpers, and types. It
  never owns business functionality and never contains a `*.module.ts` file.
- `integrations` contains clients and configuration for external systems such
  as Supabase, Postgres, LiqPay, and Nova Poshta.
- `app.module.ts` is the composition root that connects features and
  integrations.

Controllers are grouped by audience inside each feature. Only create an
audience directory when the feature actually exposes such an endpoint. Shared
services and DTOs stay outside these directories so authorization concerns do
not duplicate business logic. Do not pre-create `domain`, `application`, `api`,
or `infrastructure` directories inside every feature.

Feature documentation lives in [`modules/`](modules).

## API audiences

URLs describe resources and actions, not authentication mechanics. Access rules
remain visible in the source tree:

- Controllers in `public` must use `@Public()` and do not require an access
  token.
- Controllers in `private` use the global `AuthGuard` and require a valid access
  token cookie.
- Controllers in `admin` additionally use `AdminGuard` and require the `admin`
  role.

Authentication is the default because `AuthGuard` is global. Audience folders
do not add URL prefixes: administrative operations use the same resource-based
route design as every other endpoint.

Three route families keep the audiences from colliding on the same resource:

- `/storefront/*` is the published, customer-facing view of the catalog
  (`/storefront/products/:slug`). Admin catalog routes use the canonical
  resource paths (`/products/:id`) and see drafts and archived records.
- `/customers/me/*` holds everything the signed-in customer owns: profile,
  cart, favorites, orders, payments, custom requests, and uploads. The same
  resources are managed by administrators under canonical paths such as
  `/orders/:id` and `/custom-requests/:id`.
- Integration callbacks (`/auth/sms-hook`, `/payments/liqpay/callback`) are
  public and authenticate the caller by verifying a signature.

Next.js may use the administrator role to decide whether to render a page, but
the backend independently authorizes every administrative operation with
`AdminGuard`. Hiding a screen or receiving a frontend session DTO is never
treated as operation access control.

## Stores

One API serves two stores on the same site: **Gripr** (jewelry, `gripr`) and
**Gripr Lab** (resin-printed miniatures and figurines, `lab`). Customers have
one account for both; administrators are the same `admin` users and switch
the admin panel between the stores.

The store is a column (`app.store` enum, default `gripr`), not a copy of the
backend:

- `products`, `collections`, `tags`, `production_stages`, `orders`,
  `custom_requests`, and `design_candidates` have `store`. Metals, gemstones,
  and finishing operations are Gripr reference data; resins, printers, and
  print settings ([prints](modules/prints.md)) are Gripr Lab reference data.
  Neither kind has a `store` column.
- Printer purchase prices may be in USD; the prints module converts them with
  `readUsdRate` from the pricing module (manual, NBU, or settings rate), so
  the pricing module stays the single source of exchange rates.
- Jewelry prices add up (base, metal, stones, option surcharges), so
  auto-priced jewelry stores calculated surcharges. Lab print prices do not
  (resin grows with the cube of the size), so print-priced Lab products are
  priced live per selection: readers that configure products
  (`ProductCatalogService.loadConfigurable` for the cart and checkout, the
  storefront product and quote, `refreshPriceFrom`) wrap them with
  `withPrintPricing` from `src/modules/prints/print.context.ts`, which sets
  `ConfigurableProduct.selectionPrice`.
- A product's store follows from its type (`src/modules/catalog/product.stores.ts`):
  jewelry types belong to Gripr, print types (`miniature`, `figurine`, `bust`,
  `statue`, `terrain`, `diorama`, `prop`, `other_print`) to Gripr Lab. Each
  store has its own configurator option kinds. Collections, tags, and
  production stages get their store on creation and keep it.
- Every storefront, customer, and admin list takes `?store=` (`gripr` when
  omitted, so existing clients keep working) through `StoreQueryDto` or
  `StorePageQueryDto` from `src/shared/store`. Records of the other store are
  not listed, and storefront pages of the other store answer `404`.
- Cart lines and favorites take their store from the product. The cart is
  read, cleared, and checked out per store, so one order never mixes stores
  while the other store's lines stay in the cart.
- Orders share one number sequence and are shown with a store prefix
  (`GR-1042`, `LAB-1043`, see `order.reference.ts`).
- Each store is paid into its own LiqPay shop; Lab orders answer `409` when
  the Lab shop keys are not configured (see [Payments](#payments)).

- The Lab cart also holds confirmed print requests of customers' own models;
  checkout orders them with the catalog lines in one order (`order_items`
  with `itemKind: "print"`). Cart and orders call plain functions of
  `src/modules/prints/print.requests.cart.ts` rather than a Nest dependency.
- Custom requests, proposals, and custom orders carry the store. Gripr Lab
  requests describe a model to design with a Lab specification; their orders
  hold a `model` item (and a `print` item when printed), count big and small
  revisions in `orders.modeling`, and deliver model files owned by the order
  (`print_files.order_id`). Orders call the pure helpers of
  `src/modules/orders/order.modeling.ts`; the prints module serves the files.

Deferred Lab work (the MyMiniFactory API, product license records) is listed
in [`lab.plan.md`](lab.plan.md).

## Admin role

An administrator has `app_metadata.role` set to `admin` on their Supabase user.
Only `app_metadata` is trusted because users cannot edit it themselves. Assign
this role from a trusted server-side process or the Supabase dashboard; never
provide a public endpoint that lets a user promote their own account.

## Supabase

`SupabaseModule` is global and exposes `SupabaseService`. Its publishable-key
client has one responsibility: verify the access token received from the BFF
and return the trusted Supabase user to `AuthGuard`. NestJS does not create,
refresh, revoke, or store sessions and never receives the refresh token.

`SupabaseStorageService` uses the server-only `SUPABASE_SECRET_KEY` for the
private `lab-models` bucket (created on first use, 50 MB per file). It signs
direct browser uploads (valid two hours) and short download URLs, checks the
stored object size, downloads files for analysis, and removes them. The
secret key is never sent to browsers; without it model uploads answer `503`.

Next.js owns sign-up, sign-in, refresh, sign-out, and the frontend-host
`HttpOnly` cookies. For an operation, the BFF forwards only the access cookie.
The global NestJS `AuthGuard` verifies it again and attaches the provider user to
the request. Operation-specific guards then enforce roles or resource-level
permissions. A backend `403` is final and is not reinterpreted by Next.js.

Browser code calls the same-origin Next.js BFF:

```ts
fetch('/api/auth/sign-out', {
  method: 'POST',
});
```

`FRONTEND_URL` configures a comma-separated credentialed CORS allowlist for
trusted operational clients. Wildcard and opaque origins are rejected. Normal
browser application traffic never calls the NestJS origin; the Next.js BFF
enforces its own same-origin boundary before forwarding unsafe methods.

A production frontend at `https://example.com` uses:

```dotenv
FRONTEND_URL=https://example.com
```

### Phone sign-in

Customers sign in with a Ukrainian phone number and a one-time code. The BFF
uses Supabase phone OTP (`signInWithOtp` and `verifyOtp`); Supabase generates
and verifies the code. Delivery is delegated to this API through the Supabase
**Send SMS hook**, which calls `POST /api/auth/sms-hook`:

1. The hook request is authenticated with its Standard Webhooks signature
   (`SUPABASE_SMS_HOOK_SECRET`). The application is created with
   `rawBody: true` so the signature is computed over the exact bytes.
2. Only `+380` numbers are accepted.
3. The code is sent through the Telegram Gateway API when the number has a
   Telegram account, otherwise through TurboSMS as a Viber message with an SMS
   fallback limited to the code lifetime.
4. Errors use the Supabase hook error format, and Supabase shows the message to
   the caller of `signInWithOtp`.

The customer profile row (`app.customers`) is created on first use from the
verified Supabase user; its id is the Supabase user id.

## Database

Business data lives in Supabase Postgres and is accessed with Drizzle ORM over
the `postgres` driver (`DATABASE_URL`, prepared statements disabled for the
Supabase transaction pooler). `DatabaseModule` is global and provides the
Drizzle instance under the `DATABASE` token.

- All tables live in the `app` Postgres schema, which is not exposed through
  the Supabase Data API. Browsers never query the database directly; the API
  is the only access path.
- The schema is defined in `src/integrations/database/schema/*.schema.ts`.
  `npm run db:generate` writes SQL migrations to `drizzle/`, and
  `npm run db:migrate` applies them. `npm run db:seed` inserts reference data
  (metals, gemstones, finishing options, production stages) idempotently.
- Migrations must keep production data working: add columns with defaults or
  as nullable, backfill them in the same migration, and drop old columns in a
  later migration once the data is copied (for example `ring_size` →
  `size_value`).
- Order items store an immutable snapshot of the product name, selected
  options, prices, and production time, so catalog edits never change existing
  orders.
- Stock is reserved in the checkout transaction and returned when an order with
  stock items is cancelled.

Money is stored and transferred as integer kopiykas everywhere. Prices,
discounts, and production time are always computed by the server from the
product (manufacturing price, metal weight and price per gram, stones) and
the selected option values; amounts sent by clients are never trusted. The
product's "price from" is denormalized into `products.price_from` so listings
can filter and sort by it; every write that affects pricing recomputes it in
the same transaction.

## Integrations

- **Cloudinary** stores images. The API signs direct browser uploads for a
  fixed folder (`jewelry/products`, `jewelry/collections`,
  `jewelry/production`, `jewelry/messages`,
  `jewelry/custom-requests/<userId>`) and validates that
  submitted image references belong to that folder and cloud.
- **LiqPay** accepts payments. See [Payments](#payments).
- **Nova Poshta** provides city and branch lookup for checkout. Orders store
  the chosen refs and names, and the TTN once shipped.
- **Telegram Gateway** and **TurboSMS** deliver sign-in codes.
- **Sketchfab** and **Thingiverse** supply open-license model metadata to the
  [designs](modules/designs.md) importer; Printables and MyMiniFactory pages
  are read only when staff import a model by link. Approved previews are copied into
  Cloudinary server-side with `CloudinaryService.uploadFromUrl()`.
- **NBU** (National Bank of Ukraine) publishes official USD and precious
  metal rates without a key; the [pricing](modules/pricing.md) module stores
  them for the price calculator.
- **Supabase Storage** keeps Gripr Lab model files in a private bucket; see
  [Supabase](#supabase) and [model files](modules/prints.md#model-files).
  Uploaded files are untrusted: they are parsed only in a worker thread with
  a time and memory limit, never executed, and never served publicly.

## Scheduled jobs

`ScheduleModule.forRoot()` in `app.module.ts` enables `@nestjs/schedule`
decorators. Jobs run inside the API process, so each running API instance
executes them; a job must tolerate that or guard itself. The jobs are:

- the nightly design import (02:00 Europe/Kyiv), which holds an in-process
  run lock and is disabled with `DESIGN_IMPORT_ENABLED=false`;
- the market rate refresh (06:00 Europe/Kyiv), which stores NBU rates and
  reprices auto-priced products in one transaction; running it twice only
  repeats the same idempotent update;
- the model file cleanup (03:30 Europe/Kyiv), which deletes abandoned uploads,
  old customer files no print request or Lab custom request needs, and files
  whose owner was deleted, and fails stalled analyses; deleting twice is harmless;
- the print price expiry (03:45 Europe/Kyiv), which returns print requests
  confirmed more than 14 days ago to staff review; running it twice changes
  nothing more.

## Payments

Orders are paid through LiqPay Checkout. Each store has its own LiqPay shop
(Gripr Lab's keys are optional); `PaymentsService` reaches it through the
`PaymentProvider` interface, whose only implementation wraps the LiqPay
integration.

1. The customer asks the API to start a payment for an order. The API decides
   what is due (the full amount, the custom-order deposit, a staged
   prepayment, or the remaining balance), creates a pending `payments` row
   whose `merchant` is the order's store, and returns `data` and `signature`
   for the LiqPay checkout form, signed with that store's keys. The LiqPay
   `order_id` is the payment id.
2. The browser posts the form to LiqPay; after paying, LiqPay returns the
   customer to `LIQPAY_RESULT_URL?orderId=...`.
3. LiqPay posts the result to `POST /api/payments/liqpay/callback` on
   `PUBLIC_API_URL`. The signature (SHA3-256, or SHA-1 for legacy accounts)
   is checked with each shop's private key before anything is read; the
   matching shop must be the payment's `merchant`, otherwise `400`. The
   callback is processed in a transaction with the payment row locked and is
   idempotent. A success whose amount or currency does not match the payment
   is recorded as a failure.
4. A successful payment increases the order's `paidAmount` and moves a
   `pending_payment` order to `paid` (staged custom orders move past the
   payment stage it covers).

Fiscal receipts are issued by LiqPay's software cash register (ПРРО): when
the shop's receipt good (`LIQPAY_RRO_GOOD_ID` or `LIQPAY_LAB_RRO_GOOD_ID`) is
configured, the checkout data carries the receipt
lines (`rro_info`) and LiqPay fiscalizes the payment after it succeeds.

Administrators can also record payments received outside LiqPay.

## Order lifecycle

Order status transitions are defined in one place,
`src/modules/orders/order.status.ts`:

```text
pending_payment             -> paid | cancelled
awaiting_model_payment      -> modeling | cancelled
modeling                    -> model_review | awaiting_model_payment | cancelled
model_review                -> modeling | awaiting_production_payment | completed | cancelled
awaiting_production_payment -> in_production | cancelled
paid                        -> in_production | ready | cancelled | refunded
in_production               -> awaiting_final_payment | ready | cancelled
awaiting_final_payment      -> ready | cancelled
ready                       -> shipped | cancelled
shipped                     -> delivered
delivered                   -> completed | refunded
cancelled                   -> refunded
```

Production progress is tracked per order item with production steps created
from the stage dictionary. Custom pieces start as custom requests (or
customizations of catalog products); the workshop sends versioned proposals,
and approving one creates a `custom` order paid in stages: 3D model, then
production prepayment, then the remainder. The customer's original request
and every proposal version are kept unchanged. A paid model revision returns
a Gripr Lab order from `modeling` to `awaiting_model_payment`, and an order
of a model file only goes from `model_review` to `completed`.

## Swagger

Swagger UI is available at `/api/docs`, and the OpenAPI document is available
at `/api/docs-json`. Authenticated endpoints use the `access-token` cookie
security scheme. NestJS has no refresh-token scheme because refresh is owned by
Next.js.

The `@nestjs/swagger` CLI plugin (configured in `nest-cli.json`) derives DTO
properties from TypeScript types, `class-validator` decorators, and JSDoc
comments in `*.dto.ts` files.

Swagger routes are protected separately with HTTP Basic Auth. The browser asks
for the credentials configured in `SWAGGER_USERNAME` and `SWAGGER_PASSWORD`
before displaying the UI. These credentials protect the API documentation only;
they do not create an application user or grant access to private API endpoints.

## Testing

Unit tests (`*.spec.ts` next to the code) cover pure business logic such as
pricing, order transitions, and signatures. End-to-end tests in `test/` boot the
full application against an in-process PGlite Postgres database with the real
migrations and seed applied. Supabase (Auth and Storage, the latter by the
in-memory `test/support/storage.fake.ts`), Telegram Gateway, TurboSMS, Nova
Poshta, and (where needed) Sketchfab, Thingiverse, Cloudinary, and NBU are replaced with test
doubles; no network access or Docker is needed. Model fixtures (cubes as STL,
OBJ, 3MF, and ZIP) are built in memory by `test/support/mesh.fixtures.ts`.
PGlite requires Node's `--experimental-vm-modules` flag, which the
`test:e2e` script sets.
