# Orders module

Checkout, the customer's order history, and administrator order management.

Every order belongs to one [store](../architecture.md#stores). Orders of both
stores share one number sequence; responses include `store`, `number`, and
`reference`, the number with the store prefix (`GR-1042`, `LAB-1043`). Custom
orders belong to the store of their request; Gripr Lab custom orders are
[modeling orders](#gripr-lab-modeling).

## Customer routes

- `POST /api/customers/me/orders` (`201`): checkout. Body: `store` (`gripr`
  by default), `contactName`,
  optional `contactPhone` (defaults to the sign-in phone), `contactEmail`,
  `delivery` (`cityRef`, `cityName`, `warehouseRef`, `warehouseName` from the
  [delivery lookup](delivery.md)), `comment`, and `saveAsDefault` (stores the
  delivery on the profile).
- `GET /api/customers/me/orders?store=`: paginated summaries of one store
  (`gripr` by default).
- `GET /api/customers/me/orders/:id`: details with items, the customer-visible
  production timeline, status history, payments, and `nextPayment`.
- `POST /api/customers/me/orders/:id/cancel`: allowed only while the order is
  `pending_payment` or `awaiting_model_payment`.
- `POST /api/customers/me/orders/:id/model/approve`: approves the 3D model
  (`model_review` → `awaiting_production_payment`, or straight to
  `in_production` when the production prepayment is already covered; a Gripr
  Lab order that delivers only the file becomes `completed`).
- `POST /api/customers/me/orders/:id/model/request-changes` with
  `{ "comment" }`: returns the order to `modeling` and posts the comment to
  the [conversation](messages.md); a Gripr Lab order then waits for staff to
  classify the revision.
- `GET /api/customers/me/orders/:id/files` and
  `GET /api/customers/me/orders/:id/files/:fileId`: model files a Gripr Lab
  order delivers (see [below](#gripr-lab-modeling)).

Checkout runs in one transaction: it reprices the store's cart lines, refuses
unavailable lines (`409`) or an empty cart (`400`), reserves stock for
in-stock pieces, stores an immutable snapshot of each item, and removes the
checked-out lines; lines of the other store stay in the cart. A Lab checkout
also orders the confirmed [print requests](prints.md#print-requests) in the
cart: each model becomes an item with `itemKind: "print"`, its
`printRequestId`, `productName` `Друк: <file name>`, and the size, resin,
finish, painting, and base as `selectedOptions`; the requests become
`ordered`. Cancelling the order cancels those requests.

Items carry `itemKind`: `product` (catalog and custom pieces), `print`,
or `model` (the 3D model of a [Gripr Lab modeling order](#gripr-lab-modeling)
and its paid revisions). The order
starts as `pending_payment`; pay it through [payments](payments.md).

## Admin routes

- `GET /api/orders?store=&status=&kind=&createdFrom=&createdTo=&q=`: orders
  of one store (`gripr` by default). `q` matches the order number or
  reference (`1043`, `LAB-1043`; a reference of the other store finds
  nothing), contact phone, or contact name.
- `GET /api/orders/:id`: full details, internal note, provider payment data,
  hidden production steps, and `allowedTransitions`.
- `PATCH /api/orders/:id/status` with `{ "status", "note"? }`: the note is
  shown to the customer in the history.
- `PATCH /api/orders/:id/delivery`: Nova Poshta TTN (`trackingNumber`, 14
  digits) and delivery corrections.
- `PATCH /api/orders/:id` with `{ "adminNote" }`.
- `POST /api/orders/:id/model/revisions` with `{ "kind": "big" | "small" }`:
  classifies the changes a Gripr Lab customer asked for (see
  [below](#gripr-lab-modeling)).
- `POST /api/orders/:id/files` and `GET /api/orders/:id/files`: upload and
  list the model files a Gripr Lab order delivers.

Payments and production steps for an order are managed by the
[payments](payments.md) and [production](production.md) modules.

## Status rules

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

- `paid` requires a recorded payment. A successful payment moves a
  `pending_payment` order to `paid` automatically.
- `shipped` requires a TTN and full payment.
- `modeling -> awaiting_model_payment` needs an unpaid part of the model
  price (a paid revision); `model_review -> completed` is only for fully paid
  orders of a model file without production.
- Cancelling returns reserved stock.
- Every change is written to the status history with the author.

Order kinds are `catalog` (from the cart) and `custom` (from an accepted
[custom request](custom.requests.md)).

## Staged custom orders

An order created from an approved proposal stores `modelPaymentAmount` (0
without a 3D model) and `productionPaymentAmount`; the total is the model
price plus the product price. Payments are due in stages, each shown by
`nextPayment`:

1. `model_prepayment` while `awaiting_model_payment`;
2. `production_prepayment` while `awaiting_production_payment`;
3. `remainder` from `in_production` onward (`awaiting_final_payment` asks
   for it explicitly before `ready`).

Thresholds are cumulative: leaving `awaiting_model_payment` needs the model
price paid, leaving `awaiting_production_payment` needs model + production
prepayment, and leaving `awaiting_final_payment` needs the total. A payment
that covers the current threshold advances the order automatically. Orders
start at the first stage that still needs something: `modeling` when the
model is free, `awaiting_production_payment` without a model, and
`in_production` when nothing is due before manufacturing.

Custom order items carry the approved `specification`, and custom orders
return `customRequestId`. Requests quoted before proposals existed create a
`pending_payment` order with an optional deposit, as before.

## Gripr Lab modeling

Accepting a Gripr Lab [modeling proposal](custom.requests.md#gripr-lab-modeling)
creates a Lab custom order with a `model` item `3D-модель: <title>` at the
model price, with the deliverable as its option, and, when the model is
printed, a `print` item `Друк: <title>` at the product price with the size,
resin, finish, painting, base, and quantity as options. The order stores
`modeling`, returned in customer and admin responses: `deliverable`, the
revision `terms` of the proposal, `bigRevisions`, `smallRevisions`,
`freeBigRevisionsLeft`, `freeSmallRevisionsLeft`, `pendingRevision`, and
`license`. Other orders return `modeling: null`.

Revisions: when the customer requests changes at model review, the order
returns to `modeling` with `pendingRevision`, and it cannot go back to
`model_review` (`409`) until staff classify the changes with
`POST /api/orders/:id/model/revisions` as `big` (shape, pose, proportions)
or `small` (a detail, a size correction); classifying at any other time
answers `409`. Within the free revisions of that kind nothing is charged.
Beyond them the order gets a `model` item `Велика правка моделі` or
`Мала правка моделі` at the price from the terms, its total, subtotal, and
`modelPaymentAmount` grow by that price, and the order returns to
`awaiting_model_payment` until it is paid.

Delivered files: staff upload the finished file of an order whose
deliverable includes it with `POST /api/orders/:id/files` (the body and
signed upload of [model files](prints.md#model-files); `400` for other
orders, `409` for cancelled or refunded ones) and confirm it with
`POST /api/print-files/:id/complete`. The files are stored under
`deliverables/<orderId>/`. The customer lists uploaded files with
`GET /api/customers/me/orders/:id/files` and gets a 10-minute download URL
with the license from `GET /api/customers/me/orders/:id/files/:fileId`,
which answers `409` until the model is approved (the order is past
`model_review` and not cancelled or refunded) and the order is fully paid.
The personal-use license allows printing the model for oneself and forbids
selling or sharing the file or prints of it. A file-only order is completed
when the customer approves the model.
