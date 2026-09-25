# Auth module

Delivers phone sign-in codes for Supabase phone OTP. Supabase generates and
verifies the code; the Next.js BFF calls `signInWithOtp` and `verifyOtp`.
NestJS only delivers the code.

## Routes

- `POST /api/auth/sms-hook` (public): the Supabase **Send SMS** auth hook.

## Behavior

- The request must carry a valid Standard Webhooks signature
  (`webhook-id`, `webhook-timestamp`, `webhook-signature`) made with
  `SUPABASE_SMS_HOOK_SECRET`, at most five minutes old. Otherwise the hook
  answers `401`.
- The phone must be Ukrainian (`+380`); otherwise `400` with the message
  "Only Ukrainian phone numbers (+380) are supported", which Supabase returns
  to the BFF.
- Delivery order:
  1. Telegram Gateway (`TELEGRAM_GATEWAY_TOKEN`): checks whether the number can
     receive a code, then sends it with the code lifetime as TTL.
  2. TurboSMS (`TURBOSMS_TOKEN`, `TURBOSMS_SENDER`): a Viber message with an
     SMS fallback that is only sent while the code is still valid.
- If no channel delivers the code, the hook answers `503`.
- A successful delivery answers `200 {}`.

Errors use the Supabase hook format:
`{ "error": { "http_code": 400, "message": "..." } }`.

## Setup

In the Supabase dashboard, enable the phone provider, then add an HTTPS
**Send SMS hook** pointing to `https://<api>/api/auth/sms-hook` and copy its
secret (`v1,whsec_...`) into `SUPABASE_SMS_HOOK_SECRET`. The OTP expiry
configured in Supabase should match the five-minute code lifetime used for the
delivery TTL.
