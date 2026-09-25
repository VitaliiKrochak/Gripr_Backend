# Dashboard module

Key numbers for the admin home screen.

## Routes

- `GET /api/dashboard/summary` (admin):
  - `ordersByStatus`: order count for every status.
  - `revenue.total` and `revenue.last30Days`: successful, non-reversed
    payments in kopiykas.
  - `newCustomRequests`: requests waiting for a first response.
  - `publishedProducts`.
  - `lowStockProducts`: published in-stock products with at most one piece
    left.
  - `customers`: customer profile count.
