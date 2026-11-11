# Favorites module

The signed-in customer's saved products.

## Routes

- `GET /api/customers/me/favorites?store=`: product cards of published
  favorites of one [store](../architecture.md#stores) (`gripr` by default),
  newest first.
- `PUT /api/customers/me/favorites/:productId`: add (idempotent, `204`).
  Unknown or unpublished products answer `404`.
- `DELETE /api/customers/me/favorites/:productId`: remove (idempotent,
  `204`).
