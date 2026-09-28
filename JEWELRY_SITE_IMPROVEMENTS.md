# Jewelry site improvements

Working plan and status for the admin panel, product configuration, pricing,
custom requests, and custom order workflow overhaul. The backend lives in this
repository (`Gripr_backend`); the Next.js storefront and staff panel live in
`../Gripr_frontend`. This file is updated after every completed block.

Legend: `[ ]` not started · `[~]` in progress · `[x]` completed

## 0. Current implementation (analysis)

| Area | What exists today |
| --- | --- |
| Catalog schema | `products` (single `base_price`, `specifications` free-form jsonb, `seo_*`, `sort_order`, single `collection_id`), `option_groups` (`kind`: metal/stone/size/engraving/custom), `option_values` (`label`, `metal_id`, `gemstone_id`, `stone_carat`, `stone_size_mm`, `ring_size`, `price_delta`, `production_days_delta`, `is_default`, `is_available`), `product_images`, reference `metals` (code, name, purity, color), `gemstones`, `tags`. |
| Pricing | Pure `configureProduct()` in `catalog/product.configuration.ts`: `basePrice + Σ priceDelta` of the selected values; required groups fall back to their default. Server is the only price authority (cart, checkout, quotes). Cards/filters/sort use `products.base_price`. |
| Admin product UI | One flat form (`product.form.client.tsx`) with technical fields (`Base price`, `Order`, `Label`, free-form `Characteristics`, SEO mixed in) + a separate options editor where **every group and every value has its own Save button** (`product.options.client.tsx`). Images are a third independent panel. |
| Visibility | NestJS storefront endpoints (`/storefront/*`, cart, favorites, recommendations, quotes) already filter `status = 'published'`. **The leak is in the frontend:** product and collection pages are ISR pages (`revalidate = 60`, tagged fetches) and nothing invalidates them when an admin unpublishes, so a cached draft/archived page keeps being served. There is no admin preview for drafts (the “preview” link is hidden for non-published products). |
| Collections | A product belongs to at most one collection (`products.collection_id`). The collection form has no product picker; products are assigned from the product form only. |
| Custom requests | `custom_requests` with free-text `desired_metal`, `ring_size`, budget, images; admin sends a flat quote (title/price/deposit/days); accepting creates a `custom` order in `pending_payment` with an optional deposit. No proposal versions, no “request changes”, original request and quote share one row. |
| Orders & payments | Status machine in `orders/order.status.ts` (`pending_payment → paid → in_production → ready → shipped → delivered → completed`, plus cancel/refund). `nextPayment()` supports full / deposit / remainder. LiqPay callback increments `paid_amount`. |
| Production | Stage dictionary + per-item steps (state, note, photos, visibility, order via two PATCH swaps). |
| Messages | None. |

Database data: the live database is reached through `.env` secrets that were
not read. All schema changes are therefore designed to be **additive and
backward compatible**: new columns are nullable or defaulted, existing values
are copied (never guessed), enum values are only added, and legacy flows keep
working for rows created before the migration.

## 1. Plan by requirement

### 1.1 Draft products and visibility (§2)
- Implemented: backend storefront filters on `published` for product page, quote, recommendations, catalog search, collections, filters, favorites, cart, set purchase.
- Partial: frontend ISR cache serves unpublished pages until the next revalidation; no draft preview for admins.
- Missing: cache invalidation on catalog mutations; admin preview; regression tests for every storefront access path.
- Changes: `Gripr_frontend/src/server/gateway/api.gateway.ts` (expire the `storefront` cache tag immediately after any successful catalog mutation proxied to NestJS), new admin endpoints `GET /products/:id/preview` and `POST /products/:id/quote`, staff route `/staff/products/[id]/preview`, e2e tests.
- Migration: no.

### 1.2 New product types (§3)
- Missing: `chain`, `cufflinks`.
- Changes: `product_type` Postgres enum (+2 values), backend `PRODUCT_TYPES`, a single product-type configuration module (size system per type), frontend `PRODUCT_TYPES`, dictionaries (singular/plural, SEO copy), catalog filters (driven by API), custom request form, size presets.
- Migration: yes (`ALTER TYPE … ADD VALUE`).

### 1.3 Pricing model (§4, §5, §7)
- Implemented: server-side configurator and quote.
- Missing: metal cost from weight, stone composition, size-dependent weight, finishing options, price breakdown, a stored “price from”.
- Design (extends the existing engine instead of replacing it):
  `unit price = manufacturing price (products.base_price)`
  `+ metal price per gram × (product weight + selected size/option weight delta)`
  `+ Σ stone groups (quantity × price per stone)`
  `+ Σ price adjustments of selected options (size, engraving, coating, processing, custom…)`.
  Products without a weight or without metal prices price exactly like before, so existing products keep their prices.
- `products.price_from` caches the default-configuration price for cards, price filters and sorting; it is recomputed on every product save and when a metal price changes.
- Changes: `metals` (+`family`, `price_per_gram`), `products` (+`weight_grams`, `width_mm`, `height_mm`, `price_from`), `option_values` (+`size_value` replacing `ring_size`, +`weight_delta_grams`, +`finishing_id`), `configureProduct()`, `QuoteDto.breakdown`.
- Migration: yes.

### 1.4 Sizes (§5)
- Partial: ring sizes as `size` option values (`ring_size`).
- Missing: other size systems, weight impact of a size.
- Design: `size_value` + unit derived from the product type (`ring` → ring size, `chain`/`necklace`/`bracelet` → length in cm, others → free size). Every size value can carry a weight delta and a price adjustment. Presets for quick entry in the admin.
- Migration: yes (data copied from `ring_size`).

### 1.5 Stones (§6)
- Partial: one stone per option value.
- Missing: unlimited stone groups per product.
- Design: new `product_stones` table (gemstone, variation/quality, size mm, carat, quantity, price per stone, order). Stone *choices* for customers remain `stone` option groups.
- Migration: yes.

### 1.6 Metals (§7)
- Design: reference metals get a family (gold/silver/platinum/palladium/other), purity, colour, price per gram, availability. Product metal options pick a metal variant; the option name is taken from the metal, so there is no separate `Label`.
- Migration: yes.

### 1.7 Product options UX (§8)
- Missing: single save, clear naming, drag-and-drop, obvious default.
- Design: `POST /products` and `PATCH /products/:id` accept the whole configuration (`optionGroups`, `stones`, `images`) and upsert it in one transaction. Ids of existing rows are preserved so carts and image links keep working; new rows may carry client-generated ids so images can link to options created in the same save. Value labels and group names become optional and are derived from the metal/size/stone/finishing. UI: “Display order” via drag and drop, “Default selection” radio per group, “Available to customers”, one **Save product** button.
- Migration: no (uses 1.3 columns).

### 1.8 Characteristics (§9)
- Design: generated automatically (type, metals, fineness, weight, dimensions, stone count and composition, coating) and returned as structured `characteristics`; manual rows stay as “Additional characteristics”.
- Migration: yes (`width_mm`, `height_mm`).

### 1.9 SEO (§10)
- Design: separate “Search engine settings” section with explanations; empty fields are generated from name, type, metals, stones and collection by a frontend helper used by `generateMetadata`; the admin sees the generated preview.
- Migration: no.

### 1.10 Manufacturing operations (§11)
- Missing: engraving types, coatings, processing.
- Design: reference table `finishing_options` (kind `engraving` / `coating` / `processing`, name, default price, extra days, active). New kinds are data, not code. Option groups gain kinds `coating` and `processing`; values link to a finishing option.
- Seed: mechanical/laser engraving; rhodium, white rhodium, black rhodium, ruthenium, enamel, oxidation; pre-processing.
- Migration: yes.

### 1.11 Collections (§12)
- Missing: product picker.
- Design: `productIds` (ordered) in collection create/update; `products.collection_sort_order`; admin collection DTO returns its products; searchable multi-select picker with drag-and-drop order. A product still belongs to one collection; adding it to another moves it (shown in the picker).
- Migration: yes (`collection_sort_order`).

### 1.12 Custom jewelry request (§13)
- Partial: type, description, images, budget, free-text metal, ring size.
- Design: structured `specification` jsonb (metal from reference or “recommend”, stone groups or none/recommend, size by product type, engraving type + text, coating, processing, timeline, comments, special requirements). Names are snapshotted so reference edits never rewrite history.
- Migration: yes.

### 1.13 Proposal before production (§14, §15)
- Design: new `custom_proposals` table (versioned; status sent / approved / changes_requested / superseded; full specification, `requires_model`, model price, product price, production prepayment, days, notes, customer response). The original request is never modified. Customer: approve (with delivery details) or request changes; admin revises → new version. Request status gains `changes_requested`; `quoted` is shown as “Proposal sent”, `accepted` as “Proposal approved”.
- Migration: yes.

### 1.14 Custom order payment flow (§16)
- Design: new order statuses `awaiting_model_payment → modeling → model_review → awaiting_production_payment → in_production → awaiting_final_payment → ready → shipped → delivered → completed`. Orders store `model_payment_amount` and `production_payment_amount`; payment types gain `model_prepayment` and `production_prepayment`. Successful payments advance the order automatically. Customers approve the model or request changes from the order page. Legacy custom orders (`pending_payment` + deposit) keep their flow.
- Migration: yes.

### 1.15 Customization of catalog products (§17)
- Design: “Request customization” on the product page opens the request form prefilled from the product and the current configuration; the request has `source = customization`, `product_id` and a snapshot of the selected options, then follows the proposal flow; the proposal decides whether a (new) 3D model is needed — the model stage is skipped otherwise.
- Migration: yes (columns on `custom_requests`).

### 1.16 Production stages (§18)
- Design: commercial stages (proposal, approvals, payments, shipping) are the order status machine above; manufacturing stages are production steps. Seed adds wax/resin printing, pre-processing, engraving, coating. Editor: multi-add, drag-and-drop order (one atomic reorder endpoint), quick Start / Complete / Skip, notes, photos, remove.
- Migration: no (seed only).

### 1.17 Order messages (§19)
- Design: new `messages` module/table linked to an order **or** a custom request; author role customer/staff; attachments (Cloudinary images/renders/PDF); the order/request status at the time is stored as the message stage. Order threads also show the messages of the request that created the order.
- Migration: yes.

### 1.18 Architecture (§21) and compatibility (§22)
- Reference data in the database: metals, gemstones, finishing options, production stages, tags.
- Code-level single sources: product types + size systems (`catalog/product.types.ts`, mirrored as the frontend contract), order/request/proposal statuses and transitions (`orders/order.status.ts`, `custom.requests/custom.request.status.ts`).
- Migrations are additive; old products (no weight, no stones) price as before; legacy custom orders keep the deposit flow.

## 2. Checklist

### Backend
- [x] Schema + migrations (types, metals, finishing, product fields, stones, option values, collections order, requests, proposals, order statuses/payments, messages) — `drizzle/0002_catalog_pricing_and_proposals.sql`, `drizzle/0003_option_values_drop_ring_size.sql`
- [x] Seed: finishing options, production stages
- [x] Draft visibility tests and admin preview/quote endpoints
- [x] Pricing engine (weight × metal price, stones, size weight, breakdown) + `price_from`
- [x] Full product save (options, stones, images) with derived labels
- [x] Characteristics generation
- [x] Collections with ordered products
- [x] Custom request specification + customization source
- [x] Proposals (send, approve, request changes, decline)
- [x] Custom order status machine + staged payments + model review actions
- [x] Production steps reorder endpoint
- [x] Messages module
- [x] Unit + e2e tests, Swagger, docs

### Frontend
- [x] Storefront cache invalidation after catalog mutations (gateway expires the `storefront` tag; preview quotes excluded)
- [x] Draft preview page for staff (`/staff/products/[id]/preview`)
- [x] Product types, size systems, dictionaries (uk/en)
- [x] Reference data UI: metals (family, price/gram), finishing options
- [x] Product editor redesign (sections, drag-and-drop, single save)
- [x] Storefront configurator: size units, finishing groups, characteristics, SEO fallback, price breakdown
- [x] Collection product picker
- [x] Custom request form (structured) + customization entry point
- [x] Customer request page: proposal approve / request changes
- [x] Staff request page: original request vs proposal editor, proposal history
- [x] Order pages: workflow stepper, staged payments, model review, messages
- [x] Production editor UX
- [x] Docs, format, lint, build

### Verification
- [x] Backend build, lint, unit tests, e2e tests
- [x] Frontend format check, lint, type check, build
- [~] Main flows verified (see §3): covered end to end by backend e2e tests; the frontend was verified by type check and build, not by a browser run against a live backend

## 3. Verification log

### Backend

- `npm run build`, `npm run lint`: clean.
- `npm test`: 29 suites, 165 tests (pricing breakdown and `priceFrom`,
  derived labels, staged `nextPayment`, `statusAfterPayment`, order and
  request transitions).
- `npm run test:e2e`: 9 suites, 56 tests on PGlite with the real migrations
  and seed, including:
  - drafts: `404` for product page, quote, recommendations, favorites, and
    cart; excluded from search; staff preview and preview quote (`403` for
    customers);
  - full product save for a `chain` with weight, stones, metal price per
    gram, length sizes with weight deltas, and a coating; derived labels
    ("Довжина", "45 см"); quote breakdown; generated characteristics;
    replacing groups and stones in one PATCH; `priceFrom` recomputed after a
    metal price change; finishing kind mismatch rejected;
  - finishing options CRUD and the public reference endpoint;
  - collection product order and removal;
  - proposal v1 → customer requests changes → proposal v2 → approval →
    3D model prepayment → modeling → model review → changes → approval →
    production prepayment → production (model stages kept) → final payment
    → ready; shared request/order conversation;
  - customization of a catalog product without a 3D model (starts in
    production, engraving stage added, model stages skipped); drafts cannot
    be customized;
  - messages with attachments, folder checks, ownership, and stage links;
  - production step reorder.
- Migration check against legacy data: migrations 0000–0001 applied, a
  published product with a `ring_size` option and two metals inserted, then
  0002–0003 applied. Result: `size_value` copied (17.5), `price_from` equals
  the old `base_price` (the card price shown before), metal families
  inferred (`gold`, `silver`), `price_per_gram` empty so prices are
  unchanged.

### Frontend

- `npm run format:check`, `npm run lint`, `npx tsc --noEmit`: clean.
- `npm run build`: succeeds; the new route `/[lang]/staff/products/[id]/preview`
  is dynamic, public product and collection pages stay statically prerendered.
- Main screens and where each flow lives:
  - staff product editor (`/staff/products/new`, `/staff/products/[id]`):
    sections for main data, pricing with a live estimate, stones, option
    groups with drag-and-drop and default selection, photos, generated
    characteristics, SEO with generation hints, publication; one
    **Save product**; "Preview" opens the draft preview;
  - staff reference (`/staff/reference`): metal family and price per gram,
    finishing options tab;
  - staff collections: searchable product picker with drag-and-drop order;
  - product page: "Request customization" opens `/account/requests/new`
    with the product and the selected options prefilled;
  - customer request page: original request, current proposal with its
    payment plan, approve or request changes, proposal history, messages;
  - staff request page: original request, proposal editor (prefilled from
    the request or the previous version), history, messages;
  - order pages: payment plan, 3D model review, production stages,
    messages linked to a stage; staff production editor with drag-and-drop,
    quick Start / Complete / Skip / Reopen, notes, photos, removal.

## 4. Known limitations / follow-ups

- A product belongs to at most one collection; adding it to a collection in
  the picker moves it from its previous collection.
- Attachments go through the Cloudinary image upload, which accepts images
  and PDFs; other document types are not supported.
- Requests quoted before this change keep their flat quote and deposit flow;
  new quotes are always proposals.
- Metals need a price per gram and products a weight before the metal share
  is priced automatically; until then the manufacturing price carries the
  whole price, as before.
- The staff product editor shows a live price estimate that mirrors the
  backend formula; the saved "price from" and all customer prices are
  always computed by the API.
- The staff draft preview reuses the public product page components from
  `(public)/products/[slug]/components`; this cross-route import is
  documented in the frontend `docs/architecture.md`.
- Messages are refreshed every minute and after sending; there is no
  realtime push, so a new reply can take up to a minute to appear.
- Drag-and-drop uses native HTML drag events with move-up/move-down buttons
  as the keyboard and touch alternative.
