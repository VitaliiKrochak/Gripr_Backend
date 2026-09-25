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
order, `defaultForCatalog`, `defaultForCustom`, and `isActive`. The seed adds:

| Code | Catalog | Custom |
| --- | --- | --- |
| `modeling` (3D modeling) | | yes |
| `model-approval` | | yes |
| `fitting-print` (plastic fitting print) | | yes |
| `casting` | yes | yes |
| `stone-setting` | yes | yes |
| `polishing` | yes | yes |
| `quality-check` | yes | yes |
| `ready` | yes | yes |

## Production steps (admin)

- `POST /api/orders/:orderId/items/:itemId/production-steps` with
  `{ "stageIds"? }`: adds steps to an item. Without `stageIds`, the active
  stages marked as default for the order kind are used. Stages the item
  already has are skipped. Closed (cancelled or refunded) orders answer `409`.
- `PATCH /api/production-steps/:id`: `state` (`pending`, `in_progress`,
  `done`, `skipped`), `note`, `images` (uploaded to the `production` media
  folder), `visibleToCustomer`, and `sortOrder`.
- `DELETE /api/production-steps/:id`

Each route returns the full admin order. Moving a step to `in_progress` sets
`startedAt`; `done` sets `completedAt` (and `startedAt` if missing); `pending`
clears both dates.

Step changes do not change the order status; administrators move the order to
`in_production`, `ready`, and further through the [orders](orders.md) module.
