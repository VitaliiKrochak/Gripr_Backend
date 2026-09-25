# Delivery module

Nova Poshta lookup for the checkout form. Routes require a signed-in customer
so the API key cannot be used anonymously.

## Routes

- `GET /api/delivery/cities?q=`: at least two characters. Returns `ref`,
  `name`, `settlementType`, and `area`.
- `GET /api/delivery/warehouses?cityRef=&q=`: branches and parcel lockers in a
  city. `q` filters by number or address. Returns `ref`, `number`, `name`,
  `shortAddress`, and `category` (`Branch`, `Postomat`, `Store`).

Send the chosen city and warehouse `ref` and `name` as the checkout
`delivery`. When Nova Poshta is unavailable, the routes answer `503`.

Administrators set the TTN with `PATCH /api/orders/:id/delivery`
([orders](orders.md)).

## Configuration

`NOVAPOSHTA_API_KEY` from the Nova Poshta business account.
