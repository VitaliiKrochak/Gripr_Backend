# Account module

Owns customer authentication. The frontend sends credentials to this API, which
delegates authentication to Supabase. The application does not issue custom
JWTs or store passwords.

- `POST /api/auth/sign-up`
- `POST /api/auth/sign-in`
- `POST /api/auth/refresh`
- `POST /api/auth/sign-out`

Sign-up and sign-in accept `email` and `password`, set `HttpOnly` access and
refresh cookies, and return only the user ID and access-token expiry. Refresh
reads the refresh token from its cookie and rotates both cookies. Sign-out uses
the access-token cookie when it is still available to revoke the Supabase
session, and always clears both cookies locally.

Both cookies are `HttpOnly`, use `SameSite=Lax`, and are `Secure` in production.
The access cookie uses `Path=/`; the refresh cookie uses
`Path=/api/auth/refresh`. When `AUTH_COOKIE_DOMAIN` contains a bare parent
domain, that same domain is used while setting and clearing both cookies. When
the variable is unset or empty, the `Domain` attribute is omitted.

The same sign-in endpoint is used by the customer site and the admin panel.
Administrative operations are authorized individually with `AdminGuard`.
