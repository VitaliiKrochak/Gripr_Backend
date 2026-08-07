# Architecture

The project uses a small feature-first structure. A feature keeps its module,
controllers, services, and DTOs together without empty architectural layers.
The Next.js frontend lives in the sibling `../jewelry` repository and calls
this backend directly; there is no Next.js API proxy between the browser and
NestJS.

```text
src/
  modules/                 # business features
    account/
      public/              # unauthenticated controllers
      private/             # authenticated controllers
    health/
      public/
  shared/                  # reusable building blocks, no Nest modules
    cookies/
    decorators/
    guards/
    types/
  integrations/            # external systems
    supabase/
  swagger.ts               # OpenAPI setup and documentation access
  app.module.ts
  app.setup.ts
  main.ts
```

Each directory has one responsibility:

- `modules` contains the application features and their Nest modules.
- `shared` contains small reusable decorators, guards, and types. It never owns
  business functionality and never contains a `*.module.ts` file.
- `integrations` contains clients and configuration for external systems such
  as Supabase.
- `app.module.ts` is the composition root that connects features and
  integrations.

Controllers are grouped by audience inside each feature. Only create an
audience directory when the feature actually exposes such an endpoint. Shared
services and DTOs stay outside these directories so authorization concerns do
not duplicate business logic. Do not pre-create `domain`, `application`, `api`,
or `infrastructure` directories inside every feature.

## API audiences

URLs describe resources and actions, not authentication mechanics. Public and
private controllers may therefore share a resource prefix such as `/api/auth`.
Their access rules remain visible in the source tree:

- Controllers in `public` must use `@Public()` and do not require an access
  token.
- Controllers in `private` use the global `AuthGuard` and require a valid access
  token cookie.
- Controllers in `admin` additionally use `AdminGuard` and require the `admin`
  role.

Authentication is the default because `AuthGuard` is global. Audience folders
do not add URL prefixes: administrative operations use the same resource-based
route design as every other endpoint.

The admin frontend signs in through the same public auth endpoints as any other
client. The backend authorizes every administrative operation with `AdminGuard`,
so hiding admin screens in the frontend is never treated as access control.
The private `/api/auth/session` endpoint returns the authenticated user ID and a
server-derived `isAdmin` hint for frontend routing. It does not replace an admin
guard on any protected operation.

## Admin role

An administrator has `app_metadata.role` set to `admin` on their Supabase user.
Only `app_metadata` is trusted because users cannot edit it themselves. Assign
this role from a trusted server-side process or the Supabase dashboard; never
provide a public endpoint that lets a user promote their own account.

## Supabase

`SupabaseModule` is global and exposes `SupabaseService`. The publishable-key
client handles sign-up, sign-in, and token refresh. The secret-key client
performs server-only operations and token verification. The secret key must
never be sent to a browser, mobile client, response payload, or client-side
environment.

The frontend calls this API instead of Supabase directly. Access and refresh
tokens are stored only in `HttpOnly` cookies and are never returned in JSON.
The access cookie is available to the whole API; the refresh cookie is limited
to `/api/auth/refresh`. Cookies use `SameSite=Lax` and become `Secure` in
production. `AUTH_COOKIE_DOMAIN` optionally scopes both cookies to a shared
parent domain. Its value is a bare domain without protocol, port, or path. An
unset or empty value omits the `Domain` attribute and keeps cookies host-only,
which is the local-development behavior.

The Next.js client must include credentials in browser requests:

```ts
fetch(`${apiUrl}/api/auth/sign-out`, {
  method: 'POST',
  credentials: 'include',
});
```

`FRONTEND_URL` configures the allowed CORS origin and may contain a
comma-separated list. Credentialed CORS is enabled and wildcard origins are
rejected. Prefer serving the frontend and API from the same site. For Next.js
server-side requests, `../jewelry` uses `createServerApiClient()` to forward the
incoming cookie header explicitly because server-side HTTP clients have no
browser cookie jar. The access cookie's `/` path makes it available on the
incoming frontend request; the refresh cookie remains restricted to
`/api/auth/refresh`.

A production deployment with the frontend at `https://example.com` and the API
at `https://api.example.com` uses:

```dotenv
FRONTEND_URL=https://example.com
AUTH_COOKIE_DOMAIN=example.com
```

## Swagger

Swagger UI is available at `/api/docs`, and the OpenAPI document is available
at `/api/docs-json`. Authenticated endpoints use the `access-token` cookie
security scheme. Session refresh uses the `refresh-token` scheme.

Swagger routes are protected separately with HTTP Basic Auth. The browser asks
for the credentials configured in `SWAGGER_USERNAME` and `SWAGGER_PASSWORD`
before displaying the UI. These credentials protect the API documentation only;
they do not create an application user or grant access to private API endpoints.
