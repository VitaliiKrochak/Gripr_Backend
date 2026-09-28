# Production module

Tracks how each ordered piece is made. Administrators maintain a dictionary of
production stages and add steps to order items; customers see visible steps in
their order timeline (`GET /api/customers/me/orders/:id`, `items[].productionSteps`).

## Stage dictionary (admin)

- `GET /api/production-stages`
- `POST /api/production-stages`, `PATCH /api/production-stages/:id`
- `DELETE /api/production-stages/:id`: only for stages no order uses (`409`
  otherwise); deactivate used stages instead.

A stage has a unique `code`, a name, a customer-facing description, sort
order, `defaultForCatalog`, `defaultForCustom`, and `isActive`. The seed adds
(only missing codes, so existing stages are never overwritten):

| Code | Catalog | Custom |
| --- | --- | --- |
| `proposal`, `proposal-approval`, `model-payment` | | |
| `modeling` (3D modeling) | | yes |
| `model-approval` | | yes |
| `fitting-print` (plastic fitting print) | | yes |
| `wax-print` | | |
| `casting` | yes | yes |
| `pre-processing` | yes | yes |
| `stone-setting` | yes | yes |
| `engraving` | when needed | when needed |
| `coating` | when needed | when needed |
| `polishing` | yes | yes |
| `quality-check` | yes | yes |
| `final-payment` | | |
| `ready` | yes | yes |
| `shipped`, `completed` | | |

## Production steps (admin)

- `POST /api/orders/:orderId/items/:itemId/production-steps` with
  `{ "stageIds"? }`: adds steps to an item. Without `stageIds`, the active
  stages marked as default for the order kind are used, plus `engraving` and
  `coating` when the item has engraving text or those options (or they are in
  its specification). For staged custom orders approved without a 3D model,
  the model stages are left out. Stages the item already has are skipped.
  Closed (cancelled or refunded) orders answer `409`.
- `PUT /api/orders/:orderId/items/:itemId/production-steps/order` with
  `{ "ids": [...] }`: sets the order of all steps of the item (every step id
  exactly once, `400` otherwise).
- `PATCH /api/production-steps/:id`: `state` (`pending`, `in_progress`,
  `done`, `skipped`), `note`, `images` (uploaded to the `production` media
  folder), `visibleToCustomer`, and `sortOrder`.
- `DELETE /api/production-steps/:id`

Each route returns the full admin order. Moving a step to `in_progress` sets
`startedAt`; `done` sets `completedAt` (and `startedAt` if missing); `pending`
clears both dates.

Step changes do not change the order status; administrators move the order
through its statuses in the [orders](orders.md) module, and payments advance
staged custom orders automatically.
