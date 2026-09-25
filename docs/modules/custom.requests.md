# Custom requests module

Customers describe a piece they want; administrators review it and send a
quote; accepting the quote creates a `custom` order.

## Customer routes

- `GET /api/customers/me/custom-requests`, `GET /api/customers/me/custom-requests/:id`
- `POST /api/customers/me/custom-requests` (`201`): `productType`,
  `description`, `referenceImages` (up to 10, uploaded with
  `POST /api/customers/me/uploads/signature`), `budgetMin`, `budgetMax`
  (kopiykas), `desiredMetal`, and `ringSize`.
- `POST /api/customers/me/custom-requests/:id/accept`: accepts the quote.
  The body is the checkout contact and delivery (`contactName`,
  `contactPhone`?, `contactEmail`?, `delivery`, `comment`?, `saveAsDefault`?).
  Creates a `pending_payment` custom order with the quoted title, price,
  deposit, and production time, and returns the request with `orderId`.
- `POST /api/customers/me/custom-requests/:id/decline`: withdraws the request
  or declines the quote.

Customer responses never include the internal admin note.

## Admin routes

- `GET /api/custom-requests?status=`, `GET /api/custom-requests/:id`
- `PATCH /api/custom-requests/:id`: `status` (`in_review` or `rejected`) and
  `adminNote`.
- `POST /api/custom-requests/:id/quote`: `title`, `price`, `depositAmount`?
  (less than the price), `productionDaysMin`, `productionDaysMax`, and `note`
  (shown to the customer). Quoting again replaces the quote.

## Statuses

```text
new       -> in_review | quoted | rejected | declined
in_review -> quoted | rejected | declined
quoted    -> in_review | quoted | accepted | rejected | declined
```

`accepted`, `declined`, and `rejected` are final. Invalid changes answer `409`.

After acceptance the customer pays the deposit (or the full price) through
[payments](payments.md); administrators apply the custom production template
(modeling, model approval, fitting print, and the common stages) through
[production](production.md).
