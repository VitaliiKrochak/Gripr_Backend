# Conventions

- Create one directory per feature under `src/modules`, for example
  `src/modules/catalog` or `src/modules/orders`.
- Name project-owned files with lowercase, dot-separated segments, for example
  `health.status.dto.ts`, `order.service.ts`, and `app.e2e.spec.ts`. Do
  not use hyphens or underscores as word separators. Preserve ecosystem-defined
  filenames such as `package-lock.json` and `nest-cli.json`, and generated
  migration names in `drizzle/`.
- Keep a feature flat while it is small. Introduce a descriptive subdirectory,
  such as `dto` or `entities`, only when it groups several real files.
- Put controllers in `public`, `private`, or `admin` inside their owning feature.
  Create only the audience directories that contain real endpoints.
- Name routes after resources or actions, not their authentication level. Do not
  add `/public` or `/private` to a URL solely to describe its guard.
- Do not add `/admin` to a URL solely to describe its guard. Administrative
  controllers use resource-based routes and are distinguished by their folder
  and `AdminGuard`.
- Put resources owned by the signed-in customer under `/customers/me/...` and
  the published catalog under `/storefront/...`, so they never collide with the
  canonical admin routes for the same resources.
- Do not add generic `api`, `application`, `domain`, or `infrastructure` layers
  in advance.
- `app.setup.ts` adds the global `/api` prefix.
- Mark unauthenticated controllers or handlers explicitly with `@Public()`.
  All other endpoints require authentication by default.
- Add `@UseGuards(AdminGuard)` to every admin controller.
- Add resource-level guards or ownership checks to operations whose permission
  is narrower than "any authenticated user". Never rely on a Next.js page check
  to authorize a NestJS operation. Customer queries always filter by the
  signed-in user's id and return `404` for other customers' records.
- Authenticate public integration callbacks by verifying the provider
  signature before trusting the payload.
- Keep controllers focused on HTTP input and output. Move reusable or non-trivial
  business logic into a service in the same feature.
- Keep decision logic (pricing, status transitions, signatures) in pure
  functions that do not touch the database, so it can be unit-tested directly.
- Register controllers and services in the owning Nest module. Export a provider
  only when another feature actually needs it.
- Cover every feature module that contains business or decision-making logic
  with unit tests for that logic. A health module that only returns a static
  liveness status is exempt; add unit tests as soon as it checks dependencies,
  branches on application state, or gains any other non-trivial behavior.
- Cover every endpoint group with an end-to-end test in `test/`, including its
  authorization (`401`/`403`/`404` for other customers).
- Put only reusable decorators, guards, types, and similarly small building
  blocks in `src/shared`. Do not create a Nest module in `shared`.
- Document every controller with Swagger tags, operations, response types, and
  the correct cookie security scheme. Use `ApiCreatedResponse` for `201`
  responses and `@HttpCode(HttpStatus.OK)` for `POST` actions that do not
  create a resource.
- Name request DTOs after the action (`CreateProductDto`, `UpdateProductDto`,
  `ProductListQueryDto`) and response DTOs after the resource (`ProductDto`).
  Prefix admin-only response shapes with `Admin` (`AdminOrderDto`). Put DTOs in
  files ending with `.dto.ts` so the Swagger CLI plugin documents them; use
  JSDoc comments for property descriptions and add `@ApiProperty` only for
  enums and shapes the plugin cannot infer.
- Protect Swagger UI and its JSON/YAML documents with the credentials from
  `SWAGGER_USERNAME` and `SWAGGER_PASSWORD`.
- Put third-party clients and their Nest modules in `src/integrations`, grouped
  by provider, such as `src/integrations/supabase`. Each integration reads its
  environment variables in a `*.config.ts` factory and fails at startup when a
  required variable is missing.
- Keep sign-up, sign-in, refresh, sign-out, and browser cookie management in the
  Next.js BFF. NestJS keeps only access-token verification and operation-level
  authorization.

## Data and money

- Store and transfer money as integer kopiykas. Never accept prices from
  clients; recompute them on the server from option value ids.
- Paginate list endpoints with `PaginationQueryDto` (`page`, `pageSize` up to
  100) and return `{ items, total, page, pageSize }` via `toPage`.
- Define tables in `src/integrations/database/schema/<area>.schema.ts` inside
  the `app` Postgres schema (`appSchema`) and export them from
  `database.schema.ts`. After changing the schema, run `npm run db:generate`
  and commit the generated migration.
- Inject the database with `@Inject(DATABASE)`. Inside a transaction, pass the
  transaction executor (`tx`) to every helper that reads or writes; helpers
  that can run in a transaction accept an optional `DatabaseExecutor`
  parameter.
- Lock rows that a transaction reads before updating (`.for('update')`), for
  example orders, payments, and custom requests.
- Wrap outer columns with `qualified(column)` in correlated subqueries; Drizzle
  omits table names in single-table queries.
- Convert constraint violations into `409` responses with
  `withConflictMapping` instead of checking for duplicates first.
