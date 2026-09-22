# AGENTS.md — backend (HomeDash API server)

Inherits every rule in the [repository root `AGENTS.md`](../AGENTS.md) and the
[constitution](../.specify/memory/constitution.md). This file adds backend
specifics only.

Fastify 4 HTTP API on Node ≥ 20, TypeScript strict, SQLite (better-sqlite3, WAL)
via Drizzle ORM, Zod validation, pino logging.

## Layout

```
src/server.ts       Server bootstrap and plugin registration
src/api/            Route modules, registered via src/api/index.ts
src/services/       Business logic and integrations (Sonos, Spotify, Docker,
                    Pi-hole, calendar, photos, backup, scheduled jobs, …)
src/auth/           Sessions, CSRF, Argon2 password hashing, rate limit,
                    auth middleware, requireRole
src/lib/            CORS, security headers, RBAC/permissions, validation,
                    URL validation, token encryption, error shapes
src/db/             drizzle.ts, sqlite.ts, migrate.ts, seed.ts, schema/
src/config/         env.ts (environment parsing), dataDir.ts
scripts/            reset-admin.ts (break-glass admin reset)
tests/              unit/, integration/, contract/, helpers/, setup.ts
drizzle/            Generated SQL migrations — never hand-edited
```

## Rules

- **Declare authz on every route.** New endpoints state their auth requirement
  explicitly and default to deny; use the existing `authMiddleware` /
  `requireRole` / permission helpers rather than ad-hoc checks. Only
  `src/api/public.ts` may serve unauthenticated traffic, and it stays GET-only
  and read-only.
- **Validate at the boundary with Zod.** Reject malformed input; do not
  best-effort parse. Reuse helpers in `src/lib/validation.ts`.
- **Never log secrets or tokens.** Use the pino logger with redaction; return
  consistent error shapes from `src/lib/errors.ts` without internal details.
- **Config only through `src/config/env.ts`.** Do not read `process.env`
  elsewhere. Document any new `HOMEDASH_*` variable in
  [`docs/getting-started.md`](../docs/getting-started.md) in the same PR.
- **Schema changes are generated.** Edit `src/db/schema/`, then run
  `pnpm --filter backend db:generate`; commit the generated file in
  `drizzle/`. Never write or edit migration SQL by hand, and never edit an
  already-released migration — add a new one. Include upgrade notes and tests.
- **Persistent state lives under `HOMEDASH_DATA_DIR`.** Resolve paths through
  `src/config/dataDir.ts`; never write inside the source tree. Local
  `backend/homedash.db` / `backend/data/` are developer artifacts, not fixtures.
- **Outbound calls must respect the LAN boundary.** No internet dependency for
  core functionality, no unsolicited external callbacks, and user-supplied URLs
  go through `src/lib/url-validator.ts`.
- Auth, networking, or data-storage changes require a short threat-model note in
  the PR (what is exposed, who can reach it, how it is mitigated).

## Commands (from the repository root)

| Scope                   | Command                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit tests              | `pnpm --filter backend test:unit`                                                                                                          |
| Integration tests       | `pnpm --filter backend test:integration`                                                                                                   |
| Contract tests          | `pnpm --filter backend test:contract`                                                                                                      |
| All backend tests       | `pnpm --filter backend test`                                                                                                               |
| Typecheck (src + tests) | `pnpm --filter backend typecheck`                                                                                                          |
| Build                   | `pnpm --filter backend build`                                                                                                              |
| Dev server              | `pnpm --filter backend dev`                                                                                                                |
| Generate migration      | `pnpm --filter backend db:generate`                                                                                                        |
| Apply migrations        | `pnpm --filter backend db:migrate`                                                                                                         |
| OpenAPI lint            | `pnpm --filter backend openapi:lint` (lints `specs/001-homelab-dashboard/contracts/openapi.yaml`; currently reports pre-existing findings) |

A single test file: `pnpm --filter backend exec vitest run tests/unit/<file>`.
