# Account module

Owns customer authentication. The frontend sends credentials to this API, which
delegates authentication to Supabase. The application does not issue custom
JWTs or store passwords.

- `POST /api/auth/sign-up`
- `POST /api/auth/sign-in`
- `POST /api/auth/refresh`
- `POST /api/auth/sign-out`
- `GET /api/auth/session` (authenticated)

Sign-up and sign-in accept `email` and `password`, set `HttpOnly` access and
refresh cookies, and return only the user ID and access-token expiry. Refresh
reads the refresh token from its cookie and rotates both cookies. Sign-out uses
the access-token cookie when it is still available to revoke the Supabase
session, and always clears both cookies locally.

All four public authentication mutations use `BrowserOriginGuard`. The caller
must send an `Origin` header that exactly matches one of the comma-separated
origins in `FRONTEND_URL`. Missing, `null`, and untrusted origins receive `403`
before the controller reads credentials or cookies. This is the login/logout
CSRF boundary; credentialed CORS remains enabled separately for browser response
access.

Both cookies are `HttpOnly`, use `SameSite=Lax`, and are `Secure` in production.
The access cookie uses `Path=/`; the refresh cookie uses
`Path=/api/auth/refresh`. When `AUTH_COOKIE_DOMAIN` contains a bare parent
domain, it is used only while setting and clearing the access cookie. The
refresh cookie always omits `Domain`, making it host-only to the API. When the
variable is unset or empty, the access cookie is host-only as well.

The same sign-in endpoint is used by the customer site and the admin panel.
Administrative operations are authorized individually with `AdminGuard`.

`GET /api/auth/session` is implemented by the private controller and requires a
valid access-token cookie through the global `AuthGuard`. It returns only
`{ userId, isAdmin }`. The boolean is derived from the trusted
`app_metadata.role` value attached by the guard. It helps the frontend choose
the correct authenticated screen, but it is not authorization for an
administrative operation; every admin controller still uses `AdminGuard`.
