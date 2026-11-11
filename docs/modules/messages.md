# Messages module

Conversation between a customer and the workshop about an order, a custom
request, or a Gripr Lab [print request](prints.md#print-requests). An order
created from a custom request shares one thread with that request, so the
whole history stays together. A print request keeps its own thread, since one
order can include several.

## Customer routes

- `GET|POST /api/customers/me/orders/:id/messages`
- `GET|POST /api/customers/me/custom-requests/:id/messages`
- `GET|POST /api/customers/me/print-requests/:id/messages`

## Admin routes

- `GET|POST /api/orders/:id/messages`
- `GET|POST /api/custom-requests/:id/messages`
- `GET|POST /api/print-requests/:id/messages`

`POST` accepts `body`, `attachments` (images or PDFs uploaded through
[media](media.md)), and `stageId` (a production stage the message is about).
A message needs a body or at least one attachment. Customers can only use
their own threads (`404` otherwise) and files from their upload folder;
staff can attach files from any application folder, including `messages`.
Both routes return the whole thread, oldest first.

Each message has `authorRole` (`customer` or `staff`), `body`,
`attachments`, `stage`, `thread` (`order`, `request`, or
`print_request`), and `createdAt`.
Change requests for proposals and 3D models, and the notes of print requests
returned for changes or rejected, are posted to the thread automatically.
