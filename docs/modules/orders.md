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
  `pending_payment`.

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
pending_payment -> paid | cancelled
paid            -> in_production | ready | cancelled | refunded
in_production   -> ready | cancelled
ready           -> shipped | cancelled
shipped         -> delivered
delivered       -> completed | refunded
cancelled       -> refunded
```

- `paid` requires a recorded payment. A successful payment moves a
  `pending_payment` order to `paid` automatically.
- `shipped` requires a TTN and full payment.
- Cancelling returns reserved stock.
- Every change is written to the status history with the author.

Order kinds are `catalog` (from the cart) and `custom` (from an accepted
[custom request](custom.requests.md)). Custom orders can have a deposit.
