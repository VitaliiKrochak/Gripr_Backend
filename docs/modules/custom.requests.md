# Custom requests module

Customers describe a piece they want, or ask to customize a catalog product;
administrators review it and send versioned proposals; approving a proposal
creates a `custom` order with staged payments.

## Specification

Requests, proposals, and custom order items share one structured
`specification` (`src/shared/specification/jewelry.specification.dto.ts`):

- `productType`, `metalMode` (`specified` or `recommend`) and `metal`
  (`{ id?, name }`), `weightGrams`, and `size` (ring size or length in cm;
  cleared for types without sizes);
- `stoneMode` (`specified`, `recommend`, or `none`) and `stones`
  (`gemstoneId?`, `name`, `sizeMm`, `quantity`, `notes`); `specified` needs
  at least one stone;
- `engraving` (`{ id?, name, text }` or `null`), `coating`, and `processing`
  (finishing options, see [catalog](catalog.md));
- `timeline`, `comments`, `requirements`, and `extras` (`label`/`value`).

Referenced metals, stones, and finishing options must exist (and be active
for customer requests) and have the matching kind; their names are stored as
a snapshot so later reference changes do not rewrite history.

## Customer routes

- `GET /api/customers/me/custom-requests`, `GET /api/customers/me/custom-requests/:id`
- `POST /api/customers/me/custom-requests` (`201`): `productType`,
  `description`, `referenceImages` (up to 10, uploaded with
  `POST /api/customers/me/uploads/signature`), `budgetMin`, `budgetMax`
  (kopiykas), `specification`, and the legacy `desiredMetal` and `ringSize`.
  With `productId` (a published product) and optional `optionValueIds`, the
  request is a customization (`source: "customization"`): the product type
  comes from the product and the configured options are stored as
  `baseOptions`.
- `POST /api/customers/me/custom-requests/:id/request-changes` with
  `{ "comment" }`: marks the latest proposal `changes_requested`, moves the
  request to `changes_requested`, and posts the comment to the
  [conversation](messages.md).
- `POST /api/customers/me/custom-requests/:id/accept`: approves the latest
  proposal. The body is the checkout contact and delivery (`contactName`,
  `contactPhone`?, `contactEmail`?, `delivery`, `comment`?, `saveAsDefault`?).
  Creates the custom order (see [orders](orders.md)) and returns the request
  with `orderId`.
- `POST /api/customers/me/custom-requests/:id/decline`: withdraws the request
  or declines the proposal.

Responses contain the customer's original request (`description`,
`specification`, `baseOptions`, `product`), which is never overwritten, the
latest `proposal`, and all `proposals` (newest first). The legacy `quote`
mirrors the latest proposal. Customer responses never include the internal
admin note.

## Admin routes

- `GET /api/custom-requests?status=&source=`, `GET /api/custom-requests/:id`
- `PATCH /api/custom-requests/:id`: `status` (`in_review` or `rejected`) and
  `adminNote`.
- `POST /api/custom-requests/:id/proposals`: `title`, the final
  `specification`, `requiresModel`, `modelPrice` (3D model; ignored without a
  model), `productPrice`, `productionPrepayment` (at most the product price),
  `productionDaysMin`, `productionDaysMax`, and `note`. Creates the next
  version and supersedes open earlier versions.

A proposal has `version`, `status` (`sent`, `approved`, `changes_requested`,
`superseded`), `totalPrice` (model + product), `customerResponse`, and
`respondedAt`.

## Statuses

```text
new               -> in_review | quoted | rejected | declined
in_review         -> quoted | rejected | declined
quoted            -> in_review | quoted | changes_requested | accepted | rejected | declined
changes_requested -> in_review | quoted | rejected | declined
```

`accepted`, `declined`, and `rejected` are final. Invalid changes answer `409`.

Requests quoted before proposals existed keep their quote: accepting them
creates a `pending_payment` order with the quoted deposit, as before.
