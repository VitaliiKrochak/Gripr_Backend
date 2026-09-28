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
    designs/               # open-license Sketchfab import and review queue
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
    novaposhta/
    sketchfab/             # public model search
    supabase/
    telegram/              # Telegram Gateway API
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
- **Sketchfab** search supplies open-license jewelry model metadata to the
  [designs](modules/designs.md) importer. Approved previews are copied into
  Cloudinary server-side with `CloudinaryService.uploadFromUrl()`.

## Scheduled jobs

`ScheduleModule.forRoot()` in `app.module.ts` enables `@nestjs/schedule`
decorators. Jobs run inside the API process, so each running API instance
executes them; a job must tolerate that or guard itself. The only job is the
nightly design import (02:00 Europe/Kyiv), which holds an in-process run lock
and is disabled with `DESIGN_IMPORT_ENABLED=false`.

## Payments

Orders are paid through LiqPay Checkout:

1. The customer asks the API to start a payment for an order. The API decides
   what is due (the full amount, the custom-order deposit, a staged
   prepayment, or the remaining balance), creates a pending `payments` row, and returns signed `data` and
   `signature` for the LiqPay checkout form. The LiqPay `order_id` is the
   payment id.
2. The browser posts the form to LiqPay; after paying, LiqPay returns the
   customer to `LIQPAY_RESULT_URL?orderId=...`.
3. LiqPay posts the result to `POST /api/payments/liqpay/callback` on
   `PUBLIC_API_URL`. The callback is verified (SHA3-256, or SHA-1 for legacy
   accounts), processed in a transaction with the payment row locked, and is
   idempotent. A success whose amount or currency does not match the payment
   is recorded as a failure.
4. A successful payment increases the order's `paidAmount` and moves a
   `pending_payment` order to `paid` (staged custom orders move past the
   payment stage it covers).

Fiscal receipts are issued by LiqPay's software cash register (ПРРО): when
`LIQPAY_RRO_GOOD_ID` is configured, the checkout data carries the receipt
lines (`rro_info`) and LiqPay fiscalizes the payment after it succeeds.

Administrators can also record payments received outside LiqPay.

## Order lifecycle

Order status transitions are defined in one place,
`src/modules/orders/order.status.ts`:

```text
pending_payment             -> paid | cancelled
awaiting_model_payment      -> modeling | cancelled
modeling                    -> model_review | cancelled
model_review                -> modeling | awaiting_production_payment | cancelled
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
and every proposal version are kept unchanged.

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
migrations and seed applied. Supabase, Telegram Gateway, TurboSMS, Nova
Poshta, and (where needed) Sketchfab and Cloudinary are replaced with test
doubles; no network access or Docker is needed.
PGlite requires Node's `--experimental-vm-modules` flag, which the
`test:e2e` script sets.
