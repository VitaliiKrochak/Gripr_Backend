# Project instructions

## Project baseline

This is a TypeScript NestJS project running on Node.js 22 LTS. Use npm; treat
`package.json` and `package-lock.json` as the source of truth for dependencies,
versions, and available scripts.

## Sources of truth

Read the relevant documentation before changing the project:

- `README.md` - project setup, development, testing, and deployment commands.
- `docs/architecture.md` - source layout, module boundaries, API audiences,
  authorization, Supabase, cookies, CORS, and Swagger architecture.
- `docs/conventions.md` - implementation and naming conventions that all new
  code must follow.
- `docs/modules/<feature>.md` - feature responsibilities, routes, and behavior.
- `.env.example` - required environment variables and safe example values.
- `package.json` - installed libraries, tooling, and executable scripts.

Do not restate these documents in this file. Follow them as project rules and
resolve any inconsistency by updating the relevant source-of-truth document.

## Documentation maintenance

Documentation is part of every code change. In the same change:

- Update `docs/architecture.md` when structure, module boundaries, global HTTP
  behavior, authentication, integrations, or infrastructure decisions change.
- Update `docs/conventions.md` when adding or changing a reusable project rule
  or implementation pattern.
- Update the relevant `docs/modules/<feature>.md` when feature behavior, routes,
  authorization, inputs, or outputs change.
- Add `docs/modules/<feature>.md` for every new feature module and remove or
  revise documentation for removed features.
- Update `README.md` when setup, development, testing, or deployment workflows
  change.
- Update `.env.example` when environment variables are added, renamed, or
  removed. Never place real secrets in it.
- Keep Swagger annotations synchronized with the implemented HTTP API.

Do not leave obsolete, contradictory, or deferred documentation behind.

## Working rules

- Inspect the relevant source, tests, and documentation before editing.
- Preserve unrelated user changes and avoid unrelated refactors.
- Keep source code, tests, Swagger output, configuration examples, dependency
  files, and Markdown documentation consistent.
- Add or update tests for changed behavior.
- Before completing a change, run the relevant scripts defined in
  `package.json`; normal application changes require build, lint, unit tests,
  and integration tests.
