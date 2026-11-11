# Gripr Lab: server plan

Status: phases 1 (stores), 2 (resins, printers, print settings), 3 (print
calculator), 4 (Lab payments), 5 (model files), 6 (custom print requests),
7 (3D modeling), and 8 (model sources) built. This file is the instruction for building the
server side of Gripr Lab. When a part is built, move its final description
into `architecture.md`, `conventions.md`, and `docs/modules/<feature>.md`, and
delete it from here. The frontend plan is `docs/lab.plan.md` in the
frontend repository.

Gripr Lab is a second store on the same site: miniatures, figurines, busts,
terrain, and other pieces printed on an SLA (resin) printer. Customers can:

- buy ready models from the Lab catalog, choosing scale, resin, painting,
  base, and finish;
- upload their own model (STL, OBJ, 3MF, ZIP, STEP), see a calculated price,
  and order a print after staff confirm it;
- order a model that we design for them, as a printed piece, a model file,
  or both;
- put catalog figurines and confirmed custom prints in one cart and pay for
  them in one order.

Staff switch the admin panel between Gripr and Gripr Lab. Lab money goes to a
separate LiqPay shop and payout account.

## Decisions

| Question | Decision |
| --- | --- |
| Accounts | One site, one customer account, one sign-in. |
| Separation | Separate catalogs, carts, orders, payments, production stages, and dashboards per store. |
| Payments | A second LiqPay shop with its own keys, payout account, and fiscal receipts (ПРРО). The provider may change, so it sits behind an interface. |
| Custom prints | The customer sees the calculated price at once; staff check the model and confirm; the confirmed print goes into the cart. No minimum price. |
| Mixed orders | One Lab order can hold catalog figurines and custom prints together. |
| 3D modeling | We design models on request: printed piece, model file, or both. 500 UAH per hour, 1 big and 2 small revisions included. Delivered files are for personal use. |
| Plates | Printers run 24/7 and print many pieces per plate (about 20 small ones in 4 hours); each piece pays its share of the plate. |
| Work rate | 50 UAH per hour of post-processing by default, editable. |
| Supports | A support percentage of the model volume from the settings; staff can enter the exact resin and time from the slicer. |
| Printers | Elegoo Saturn 4 Ultra 16K now, a second printer soon: printers are a list from the start. |
| Taxes | 6% of revenue plus fixed costs of 5 000 UAH per month, spread over the expected pieces per month. |
| Electricity | About 1 UAH per hour of printing. |
| Painting | Twice the unpainted price for normal painting, three times for complex painting. |
| Customer view | Only the price and the resin type. Printing time is always 2 to 3 days (modeling is quoted separately). |
| Product options | Scale or height, resin, painting, base, support removal and sanding. |
| File formats | STL, OBJ, 3MF, and ZIP are measured automatically. STEP is accepted but priced by staff. |
| File storage | Supabase Storage, private bucket, Free plan: at most 50 MB per file and 1 GB in total. |
| Model sources | Sketchfab, Thingiverse, Printables, MyMiniFactory and Scan the World. |

## 1. Stores

Built. The store split, Lab product types and option kinds, order
references, and Lab production stages are described in
[architecture](architecture.md#stores) and the module docs. Still to do in
later phases:

- Add a `lab` admin role only if other staff will work only on Lab.

## 2. Resins

Built, see [prints](modules/prints.md#resins). Print requests show the resin
name, never the price.

## 3. Print calculator

Built, see [prints](modules/prints.md#print-calculator): the pure engine
(unit tested with the example below), `POST /api/print-pricing/calculate`
for one-off pieces, printers with USD costs, shared plates, and the print
settings. Staff price print requests on another printer while reviewing them
(phase 6).

### Example

Saturn 4 Ultra 16K with the defaults, USD at 42 UAH (the real rate comes
from NBU). ABS-like resin 700 UAH/kg, density 1.10 (0.77 UAH per ml). A
model of 20 ml, 60 mm tall, 25 × 25 mm footprint, supports removed, no
base, one copy. Footprint with spacing 30 × 30 = 900 mm²; the plate gives
211.68 × 118.37 × 70% = 17 540 mm², so 19 pieces fit and the share is 1/19.

| Line | Calculation | Shared plate, UAH | Alone on the plate, UAH |
| --- | --- | --- | --- |
| Resin | 20 × 1.20 × 1.05 = 25.2 ml → 27.7 g × 0.70 | 19.40 | 19.40 |
| Print time | 1 200 layers: 5 × 30 s + 1 195 × 5.5 s + 10 min = 2.03 h | | |
| Electricity | 2.03 h × 1 UAH × share | 0.11 | 2.03 |
| Printer wear | 2.03 h × 23 646 / 5 000 h × share | 0.51 | 9.60 |
| LCD wear | 2.03 h × 5 922 / 2 000 h × share | 0.32 | 6.01 |
| Film wear | 1 200 layers × 252 / 60 000 × share | 0.27 | 5.04 |
| Consumables | (gloves 6 + alcohol 4.5 + towels 2 + filters 7.5) × share | 1.05 | 20.00 |
| Failures | 10% of resin + electricity + wear | 2.06 | 4.21 |
| Work | 20 min × 50 UAH/h | 16.67 | 16.67 |
| Fixed costs | 5 000 UAH / 500 pieces | 10.00 | 10.00 |
| Cost | | 50.38 | 93.00 |
| With 50% markup | | 75.57 | 139.50 |
| With 6% tax and 1.5% fee | ÷ 0.925 | 81.70 | 150.81 |
| Unpainted price | rounded up to 10 UAH | 90 | 160 |
| Painted | × 2 | 180 | 320 |
| Complex painting | × 3 | 270 | 480 |

USD at 42 UAH, the 50% markup, the consumables, and 500 pieces per month are
placeholders; you set the real ones in the admin panel. On a shared plate
resin is the biggest cost of a piece; printer time matters only for pieces
that fill the plate.

## 4. Lab catalog products

Built, see [catalog](modules/catalog.md#print-pricing): `products.print`
(`auto` or `manual`), the print fields of Lab option values, per-selection
prices in quotes, the cart, and checkout, the cheapest combination as
`price_from`, `POST /api/print-pricing/product-preview`, and repricing on
resin, printer, settings, and USD rate changes. Still to do:

- Every Lab product can carry a license record (see
  [sources](#9-model-sources)): source, author, license, the license URL,
  and for bought commercial licenses the proof file and purchase date.
  Publishing needs either our own design or a license that allows selling
  prints.

## 5. Model files

Built, see [model files](modules/prints.md#model-files): the private `lab-models`
bucket through `SUPABASE_SECRET_KEY`, signed uploads and downloads, `print_files`
with measurements, the STL/OBJ/3MF/ZIP parsers in a worker thread with
archive limits, STEP files measured by staff, product models (`print.printFileId`),
and the nightly cleanup.

## 6. Custom print requests

Built, see [print requests](modules/prints.md#print-requests): `print_requests`
and `print_request_items` with the customer's choices and a calculation
snapshot per item, stateless quotes, staff printer, painting, and slicer
adjustments at the printed size, confirmation for 14 days with a nightly
expiry, bases in the print settings, print lines in the Lab cart, mixed
checkout (`order_items.itemKind` and `printRequestId`), cancellation with
the order, per-request conversations, and model files kept while requests
need them. Unlike the first draft, `cart_items` is unchanged: a request in
`in_cart` is itself the cart entry, so a print cannot get a quantity or
options in the cart.

## 7. 3D modeling

Built, see [Gripr Lab modeling](modules/custom.requests.md#gripr-lab-modeling)
and [modeling orders](modules/orders.md#gripr-lab-modeling): Lab custom
requests with a Lab specification (deliverable, height, resin, finish,
painting, base, quantity, and the customer's source file), proposals priced
from modeling hours with the revision terms snapshotted, orders with a
`model` item and a `print` item for printed deliverables, big and small
revisions classified by staff with paid ones returning the order to model
payment, delivered files under `deliverables/<orderId>/` with the
personal-use license and downloads after approval and full payment, and
`model_review -> completed` for file-only orders. Modeling orders stay out
of the cart. Still to do: a file-only order still asks for delivery details
at acceptance, and turning a model into a Lab catalog product is manual.

## 8. Payments

Built, see [payments](modules/payments.md#stores-and-providers): a second
LiqPay shop for Lab (`LIQPAY_LAB_*`, optional), the `PaymentProvider`
interface with LiqPay as its implementation, `payments.merchant` and`
`payments.provider`, callbacks verified with every shop's key and matched to
the payment's merchant, Lab receipt goods, and manual payments per store.
Still to do outside the code: activate the Lab shop and its ПРРО (sales
point, cashier, good such as "Друкована мініатюра") in LiqPay.

## 9. Model sources

Built, see [designs](modules/designs.md): candidates per store, unique by
store, source, and source id; `cc_by_sa` and `cc_by_nd` for Lab (ND is
always at least `review`); Lab queries for Sketchfab; the nightly Thingiverse
import with `THINGIVERSE_API_TOKEN` and the license read again from the thing
details; import by link for Sketchfab, Thingiverse, Printables, and
MyMiniFactory, with the license chosen by staff for page sources; Lab
relevance profiles; and the extended franchise IP list. Still to do:

- The MyMiniFactory API (v2, key by request from info@myminifactory.com):
  import only models whose `commercial-use` flag is true, including Scan the
  World museum scans. Until then MyMiniFactory models are imported by link.
- Commercial and merchant licenses (Cults CU, MyMiniFactory store, Patreon
  merchant tiers) are bought manually; their proof belongs to the product
  license record (see [Lab catalog products](#4-lab-catalog-products)).
- Not automated, but good: Cults3D (CU licenses, API without files) and
  Smithsonian Open Access 3D (CC0).

## 10. Production

Built: Lab production stages (see [production](modules/production.md)).
Still to do: add `lab-priming` and `lab-painting` automatically when the
item has a painted `painting` option, once painting values carry their
multiplier.

## 11. What else is needed

Not in the request, but needed for a working store:

- **Legal and tax**: check that the ФОП's КВЕД covers manufacturing printed
  goods and design services. The second LiqPay shop needs its own company
  activation and a PrivatBank payout account for fiscal receipts.
- **Customer files**: terms the customer accepts (they own the rights, we
  may refuse), a list of forbidden content (weapon and firearm parts,
  copyrighted characters, offensive content), and how long files are kept.
- **Returns**: custom prints are made to the customer's file and are not
  returnable under Ukrainian consumer law; catalog prints are. State it on
  the site and in the offer.
- **Product safety**: resin figurines are collectibles, not toys: "not for
  children under 14, small parts", not food safe. Show it on every product.
- **Print quality limits**: minimum wall thickness (about 0.8 mm), minimum
  detail, large models need hollowing and drain holes (less resin, cheaper
  price), models bigger than the build plate must be split and glued.
- **Production capacity**: the printers run 24/7, about 720 hours a month
  each, so printing is rarely the limit; post-processing and painting by
  hand are. The dashboard should show the pieces and painting work ordered
  for the next 3 days, and staff can set a longer time on a single order.
- **Resin stock**: optional tracking of remaining resin to warn before it
  runs out.
- **Delivery**: printed pieces are fragile; packaging cost and parcel size
  per order for Nova Poshta.
- **Quantity**: discounts for many copies and for full plates.
- **Photos before shipping**: staff attach a photo of the finished print to
  the order.
- **SEO and branding**: separate titles, logo, and URLs (`/lab/...`) for Lab
  pages, covered in the frontend plan.
- **Notifications**: tell the customer when the file is analysed, the price
  is confirmed, and the order changes status.

## 12. Open questions

Answered: 6% tax plus 5 000 UAH fixed costs; Elegoo Saturn 4 Ultra 16K
with the elegoo.com prices; about 1 UAH per printing hour; 24/7 printing,
about 20 small pieces per plate in 4 hours; work rate 50 UAH/h, editable;
painting × 2 or × 3; customers see only the price; always 2 to 3 days;
mixed orders; no minimum price; 3D modeling at 500 UAH/h with 1 big and 2
small revisions; delivered files for personal use.

Still open (the defaults are used until then, all editable in admin):

1. Markup: 50% by default.
2. Expected sold pieces per month for the fixed-cost share: 500 by default.
3. Prices of paid revisions beyond the free ones: 1 000 UAH big, 250 UAH
   small by default.
4. Payment provider for Lab: LiqPay by default; fiscal receipts through
   LiqPay need a PrivatBank payout account.

## 13. Build order

Each phase ends with build, lint, unit tests, end-to-end tests, Swagger, and
docs, as `AGENTS.md` requires.

1. **Stores** (done): `store` enum and columns with backfill, store filters
   on every list, the cart/checkout split, order references, Lab product
   types and option kinds, Lab production stages.
2. **Resins, printers, and print settings** (done): tables, seed (ABS-like
   resin, Saturn 4 Ultra 16K), admin routes, the storefront resin list, USD
   conversion through the pricing USD rate.
3. **Print calculator** (done): the pure engine with unit tests (the example
   above as a test), `products.print` with `auto` mode, per-selection
   quotes and cart prices, `price_from`, the combination preview, repricing.
4. **Lab payments** (done): the payment provider interface, the second
   LiqPay merchant, `payments.merchant` and `payments.provider`, callback
   verification with both keys, separate receipts.
5. **Model files** (done): Supabase Storage integration, signed uploads, the mesh
   parsers and analysis worker, cleanup job.
6. **Custom print requests** (done): request lifecycle, quotes, staff
   overrides, confirmation, print lines in the cart, mixed checkout.
7. **3D modeling** (done): Lab custom requests and specification, modeling
   price, big and small revisions, file deliverables with the personal-use
   license and downloads, the `model_review -> completed` transition.
8. **Model sources** (done): store-aware importer, Lab queries for Sketchfab,
   Thingiverse, import by link, the extended IP list. The MyMiniFactory API
   waits for its key.
