# Conventions

- Create one directory per feature under `src/modules`, for example
  `src/modules/catalog` or `src/modules/orders`.
- Keep a feature flat while it is small. Introduce a descriptive subdirectory,
  such as `dto` or `entities`, only when it groups several real files.
- Put controllers in `public`, `private`, or `admin` inside their owning feature.
  Create only the audience directories that contain real endpoints.
- Name routes after resources or actions, not their authentication level. Do not
  add `/public` or `/private` to a URL solely to describe its guard.
- Do not add `/admin` to a URL solely to describe its guard. Administrative
  controllers use resource-based routes and are distinguished by their folder
  and `AdminGuard`.
- Do not add generic `api`, `application`, `domain`, or `infrastructure` layers
  in advance.
- `app.setup.ts` adds the global `/api` prefix.
- Mark unauthenticated controllers or handlers explicitly with `@Public()`.
  All other endpoints require authentication by default.
- Add `@UseGuards(AdminGuard)` to every admin controller.
- Keep controllers focused on HTTP input and output. Move reusable or non-trivial
  business logic into a service in the same feature.
- Register controllers and services in the owning Nest module. Export a provider
  only when another feature actually needs it.
- Put only reusable decorators, guards, types, and similarly small building
  blocks in `src/shared`. Do not create a Nest module in `shared`.
- Keep auth cookie names and options centralized in `src/shared/cookies`.
- Document every controller with Swagger tags, operations, response types, and
  the correct cookie security scheme.
- Protect Swagger UI and its JSON/YAML documents with the credentials from
  `SWAGGER_USERNAME` and `SWAGGER_PASSWORD`.
- Put third-party clients and their Nest modules in `src/integrations`, grouped
  by provider, such as `src/integrations/supabase`.
