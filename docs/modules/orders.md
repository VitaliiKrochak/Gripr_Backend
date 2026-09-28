# Orders module

Checkout, the customer's order history, and administrator order management.

## Customer routes

- `POST /api/customers/me/orders` (`201`): checkout. Body: `contactName`,
  optional `contactPhone` (defaults to the sign-in phone), `contactEmail`,
  `delivery` (`cityRef`, `cityName`, `warehouseRef`, `warehouseName` from the
  [delivery lookup](delivery.md)), `comment`, and `saveAsDefault` (stores the
  delivery on the profile).
- `GET /api/customers/me/orders`: paginated summaries.
- `GET /api/customers/me/orders/:id`: details with items, the customer-visible
  production timeline, status history, payments, and `nextPayment`.
- `POST /api/customers/me/orders/:id/cancel`: allowed only while the order is
  `pending_payment` or `awaiting_model_payment`.
- `POST /api/customers/me/orders/:id/model/approve`: approves the 3D model
  (`model_review` → `awaiting_production_payment`, or straight to
  `in_production` when the production prepayment is already covered).
- `POST /api/customers/me/orders/:id/model/request-changes` with
  `{ "comment" }`: returns the order to `modeling` and posts the comment to
  the [conversation](messages.md).

Checkout runs in one transaction: it reprices the cart, refuses unavailable
lines (`409`) or an empty cart (`400`), reserves stock for in-stock pieces,
stores an immutable snapshot of each item, and clears the cart. The order
starts as `pending_payment`; pay it through [payments](payments.md).

## Admin routes

- `GET /api/orders?status=&kind=&createdFrom=&createdTo=&q=`: `q` matches the
  order number, contact phone, or contact name.
- `GET /api/orders/:id`: full details, internal note, provider payment data,
  hidden production steps, and `allowedTransitions`.
- `PATCH /api/orders/:id/status` with `{ "status", "note"? }`: the note is
  shown to the customer in the history.
- `PATCH /api/orders/:id/delivery`: Nova Poshta TTN (`trackingNumber`, 14
  digits) and delivery corrections.
- `PATCH /api/orders/:id` with `{ "adminNote" }`.

Payments and production steps for an order are managed by the
[payments](payments.md) and [production](production.md) modules.

## Status rules

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

- `paid` requires a recorded payment. A successful payment moves a
  `pending_payment` order to `paid` automatically.
- `shipped` requires a TTN and full payment.
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
