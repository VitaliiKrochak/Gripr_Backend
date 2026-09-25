# Media module

Signs direct browser uploads to Cloudinary. Files never pass through the API.

## Routes

Admin:

- `POST /api/media/upload-signature` with `{ "folder": "products" |
  "collections" | "production" }`: returns `cloudName`, `apiKey`, `timestamp`,
  `folder`, `signature`, and `uploadUrl`.
- `POST /api/media/destroy` with `{ "publicId": "jewelry/..." }`: deletes an
  application asset (`204`). Only ids under the `jewelry/` root are accepted.

Private (signed-in customer):

- `POST /api/customers/me/uploads/signature`: signs uploads into
  `jewelry/custom-requests/<userId>` for custom request reference images.

## Upload flow

1. Request a signature.
2. POST the file to `uploadUrl` as `multipart/form-data` with `file`,
   `api_key`, `timestamp`, `folder`, and `signature`.
3. Send Cloudinary's `public_id` and `secure_url` to the API as
   `{ "publicId", "url", "alt"? }`.

Endpoints that accept images check that the asset belongs to the configured
cloud and the expected folder; images from other folders are rejected with
`400`.
