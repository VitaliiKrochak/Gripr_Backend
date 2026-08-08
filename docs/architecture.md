# Architecture

The project uses a small feature-first structure. A feature keeps its module,
controllers, services, and DTOs together without empty architectural layers.
The Next.js frontend lives in the sibling `../jewelry` repository and exposes
a same-origin BFF between browser code and NestJS.

```text
src/
  modules/                 # business features
    health/
      public/
  shared/                  # reusable building blocks, no Nest modules
    cookies/
    decorators/
    guards/
    origins/
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

URLs describe resources and actions, not authentication mechanics. Access rules
remain visible in the source tree:

- Controllers in `public` must use `@Public()` and do not require an access
  token.
- Controllers in `private` use the global `AuthGuard` and require a valid access
  token cookie.
- Controllers in `admin` additionally use `AdminGuard` and require the `admin`
  role.

Authentication is the default because `AuthGuard` is global. Audience folders
do not add URL prefixes: administrative operations use the same resource-based
route design as every other endpoint.

Next.js may use the administrator role to decide whether to render a page, but
the backend independently authorizes every administrative operation with
`AdminGuard`. Hiding a screen or receiving a frontend session DTO is never
treated as operation access control.

## Admin role

An administrator has `app_metadata.role` set to `admin` on their Supabase user.
Only `app_metadata` is trusted because users cannot edit it themselves. Assign
this role from a trusted server-side process or the Supabase dashboard; never
provide a public endpoint that lets a user promote their own account.

## Supabase

`SupabaseModule` is global and exposes `SupabaseService`. Its publishable-key
client has one responsibility: verify the access token received from the BFF
and return the trusted Supabase user to `AuthGuard`. NestJS does not create,
refresh, revoke, or store sessions and never receives the refresh token.

Next.js owns sign-up, sign-in, refresh, sign-out, and the frontend-host
`HttpOnly` cookies. For an operation, the BFF forwards only the access cookie.
The global NestJS `AuthGuard` verifies it again and attaches the provider user to
the request. Operation-specific guards then enforce roles or resource-level
permissions. A backend `403` is final and is not reinterpreted by Next.js.

Browser code calls the same-origin Next.js BFF:

```ts
fetch('/api/auth/sign-out', {
  method: 'POST',
});
```

`FRONTEND_URL` configures a comma-separated credentialed CORS allowlist for
trusted operational clients. Wildcard and opaque origins are rejected. Normal
browser application traffic never calls the NestJS origin; the Next.js BFF
enforces its own same-origin boundary before forwarding unsafe methods.

A production frontend at `https://example.com` uses:

```dotenv
FRONTEND_URL=https://example.com
```

## Swagger

Swagger UI is available at `/api/docs`, and the OpenAPI document is available
at `/api/docs-json`. Authenticated endpoints use the `access-token` cookie
security scheme. NestJS has no refresh-token scheme because refresh is owned by
Next.js.

Swagger routes are protected separately with HTTP Basic Auth. The browser asks
for the credentials configured in `SWAGGER_USERNAME` and `SWAGGER_PASSWORD`
before displaying the UI. These credentials protect the API documentation only;
they do not create an application user or grant access to private API endpoints.
