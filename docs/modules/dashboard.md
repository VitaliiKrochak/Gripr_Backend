# Dashboard module

Key numbers for the admin home screen.

## Routes

- `GET /api/dashboard/summary?store=` (admin): the numbers of one
  [store](../architecture.md#stores) (`gripr` by default):
  - `ordersByStatus`: order count for every status.
  - `revenue.total` and `revenue.last30Days`: successful, non-reversed
    payments of the store's orders in kopiykas.
  - `newCustomRequests`: requests waiting for a first response.
  - `publishedProducts`.
  - `lowStockProducts`: published in-stock products with at most one piece
    left.
  - `customers`: customer profile count, shared by both stores.
