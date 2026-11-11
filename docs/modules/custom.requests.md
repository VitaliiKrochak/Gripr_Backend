# Custom requests module

Customers describe a piece they want, or ask to customize a catalog product,
or ask [Gripr Lab](#gripr-lab-modeling) to design a 3D model; administrators
review it and send versioned proposals; approving a proposal creates a
`custom` order with staged payments.

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
- `POST /api/customers/me/custom-requests` (`201`): `store` (`gripr` by
  default), `productType` (a type of that store), `description`, `referenceImages` (up to 10, uploaded with
  `POST /api/customers/me/uploads/signature`), `budgetMin`, `budgetMax`
  (kopiykas), `specification`, and the legacy `desiredMetal` and `ringSize`.
  With `productId` (a published product) and optional `optionValueIds`, the
  request is a customization (`source: "customization"`): the product type
  comes from the product and the configured options are stored as
  `baseOptions`; only Gripr products can be customized (a Gripr Lab product
  answers `400`). Gripr Lab requests send `labSpecification` instead (see
  below).
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

Responses contain `store` and the customer's original request
(`description`, `specification`, `labSpecification`, `baseOptions`,
`product`), which is never overwritten, the
latest `proposal`, and all `proposals` (newest first). The legacy `quote`
mirrors the latest proposal. Customer responses never include the internal
admin note.

## Admin routes

- `GET /api/custom-requests?store=&status=&source=`,
  `GET /api/custom-requests/:id`: the list shows one
  [store](../architecture.md#stores) (`gripr` by default).
- `PATCH /api/custom-requests/:id`: `status` (`in_review` or `rejected`) and
  `adminNote`.
- `POST /api/custom-requests/:id/proposals`: `title`, the final
  `specification` (Gripr) or `labSpecification` (Gripr Lab), `requiresModel`,
  `modelPrice` (3D model; ignored without a model, required with one unless
  `modelingHours` is given), `modelingHours` (Gripr Lab), `productPrice`,
  `productionPrepayment` (at most the product price), `productionDaysMin`,
  `productionDaysMax`, and `note`. Gripr proposals need a `productPrice` of
  at least 1. Creates the next version and supersedes open earlier versions.

A proposal has `version`, `status` (`sent`, `approved`, `changes_requested`,
`superseded`), `totalPrice` (model + product), `customerResponse`, and
`respondedAt`; Gripr Lab proposals also return `labSpecification`,
`modelingHours`, and `revisionTerms`.

## Gripr Lab modeling

Customers of Gripr Lab can ask us to design a model from photos, a sketch, or
a description, or to fix and adapt their own file. A Lab request has a print
`productType` (`miniature`, `bust`, ...) and a `labSpecification`;
`specification`, `productId`, and `optionValueIds` answer `400`, as does a
`labSpecification` on a Gripr request. The Lab specification has:

- `deliverable`: `print` (a printed piece), `file` (the model file), or
  `print_and_file`;
- `heightMm` (5 to 1 000), the printed height and the scale of the model;
- `resinId` (an active resin from `GET /api/storefront/resins`; inactive
  resins are accepted in staff proposals), `finish` (`raw`,
  `supports_removed`, `sanded`), `painted`, `baseCode` (a base from the
  [print settings](prints.md#print-requests)), and `quantity` (1 to 100);
  cleared when only the file is delivered;
- `sourceFileId`: the customer's own [model file](prints.md#model-files) to
  start from (`400` for another customer's file);
- `comments`.

Responses snapshot the names: `resin` (`{ id, name }`), `base`
(`{ code, name }`), and `sourceFile` (`{ id, name }`). A source file used by
an open request cannot be deleted, and the nightly cleanup keeps it (see
[model files](prints.md#model-files)).

Lab proposals always include a model (`requiresModel: false` answers `400`).
With `modelingHours` the model price is the hours at the modeling rate of the
print settings, grossed up for the tax and payment fee and rounded like print
prices (4 hours at 500 UAH give 2 170 UAH); otherwise `modelPrice` is used.
The proposal stores the current `revisionTerms` (`freeBig`, `freeSmall`,
`bigPrice`, `smallPrice`). A `file` deliverable has `productPrice` and
`productionPrepayment` 0; printed deliverables need a `productPrice` of at
least 1, the price of the print.

Accepting a Lab proposal creates a Gripr Lab order with a model item and, for
printed deliverables, a print item (see
[orders](orders.md#gripr-lab-modeling)). Acceptance still asks for delivery
details even when only the file is delivered.

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
