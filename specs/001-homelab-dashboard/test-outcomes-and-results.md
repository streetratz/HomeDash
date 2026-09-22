# Test Outcomes and Results: HomeDash (001-homelab-dashboard)

**Project**: Customizable Home Lab Dashboard  
**Date**: 2026-02-21  
**Repo**: `/workspace/HomeDash`
**Tool Versions**: Node 20 LTS · TypeScript 5.5 · Vitest 1.6.1 · Playwright 1.45 · pnpm 10.30.1

---

## Phase 1: Setup (Shared Infrastructure)

**Tasks**: T001–T014  
**Date/Time**: 2026-02-21 (morning session)  
**Purpose**: Scaffold repo structure, tooling, CI, and workspace wiring.

### Backend — Phase 1

| Check | Command | Outcome |
|-------|---------|---------|
| TypeScript typecheck | `tsc --noEmit` | ✅ PASS (no src files yet — placeholder only) |
| Test run | `pnpm test` | ⚠️ SKIPPED — Vitest not yet configured in Phase 1 |

**Notes**:  
Phase 1 created `backend/src/server.ts` as a one-line placeholder export (`export {};`). No business logic existed yet. TypeScript compilation passed trivially. The Vitest harness (T034) was explicitly scheduled for Phase 2, so no test runner was configured or executed in this phase.

### Frontend — Phase 1

| Check | Command | Outcome |
|-------|---------|---------|
| TypeScript typecheck | `tsc --noEmit` | ✅ PASS (minimal `main.tsx` scaffold only) |
| Playwright E2E | `playwright test` | ⚠️ SKIPPED — config not yet scaffolded |
| Vite build | `vite build` | ✅ PASS (bare React entry renders "HomeDash — loading…") |

**Notes**:  
`frontend/src/main.tsx` was a minimal React stub with a static loading message. No router, API client, or state management wired yet. Playwright config (T039) was scheduled for Phase 2.

### Phase 1 Errors and Fixes

*No errors recorded. Phase 1 was pure scaffolding with no executable logic.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Tasks**: T015–T039, T113, T130  
**Date/Time**: 2026-02-21 (afternoon session)  
**Purpose**: Core infrastructure — env config, DB schema, migrations, Fastify server, route scaffolds, error handling, test harness, frontend router, API client, TanStack Query, Playwright config.

### Backend — Phase 2

| Check | Command | Outcome |
|-------|---------|---------|
| Initial typecheck (T015–T031) | `cd backend && npx tsc --noEmit` | ❌ FAIL — 4 errors (Run 1) |
| Typecheck after fixes | `cd backend && npx tsc --noEmit` | ✅ PASS — 0 errors (Run 2) |
| Migration generation (deprecated subcommand) | `cd backend && npx drizzle-kit generate:sqlite` | ❌ FAIL — deprecated command (Run 3) |
| Migration generation (dialect key missing) | `cd backend && npx drizzle-kit generate` | ❌ FAIL — Zod validation error (Run 4) |
| Migration generation after `dialect` fix | `cd backend && npx drizzle-kit generate` | ✅ PASS — 10 tables (Run 5) |
| Backend test run (no test files yet) | `cd backend && pnpm test` | ❌ FAIL — exit code 1 (Run 6) |
| Backend test run after `passWithNoTests` | `cd backend && pnpm test` | ✅ PASS — exit code 0 (Run 7) |
| Test helper type-check | `cd backend && npx tsc … tests/helpers/http.ts` | ❌ FAIL — TS2322 (Run 8) |
| Full typecheck (src + tests) | `cd backend && pnpm run typecheck` | ✅ PASS — 0 errors (Run 9) |

---

#### Run 1: Initial typecheck after implementing T015–T031

**Command**: `cd backend && npx tsc --noEmit`  
**Time**: 2026-02-21 ~14:00  
**Result**: ❌ FAIL — 4 errors across 2 files

| File | Line | Error Code | Message |
|------|------|-----------|---------|
| `src/db/migrate.ts` | 36 | TS2352 | Conversion of type `Db` (Drizzle) to `Database` (better-sqlite3) may be a mistake — neither type overlaps sufficiently |
| `src/server.ts` | 99 | TS1378 | Top-level `await` expressions only allowed when `module` is `es2022`/`esnext`/`node16`+ |
| `src/server.ts` | 104 | TS1378 | Same — `await app.listen(…)` at top level |
| `src/server.ts` | 105 | TS1378 | Same — `await runMigrations(…)` at top level |

**Root cause — `src/db/migrate.ts` TS2352**:  
`isMigrationHealthy()` cast `getDb()` (which returns the Drizzle wrapper `Db`) directly to `import('better-sqlite3').Database`. These are structurally incompatible types (Drizzle wraps the raw driver; the raw driver is not a property of it).

**Fix applied** (`src/db/migrate.ts`):
```typescript
// Before (incorrect cast):
(raw as import('better-sqlite3').Database).prepare(…).get();

// After (use getSqliteDb() directly — returns the raw better-sqlite3 instance):
import { getSqliteDb } from './sqlite.js';
const raw = getSqliteDb();
raw.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get();
```

**Root cause — `src/server.ts` TS1378**:  
`backend/tsconfig.json` sets `"module": "CommonJS"`. Top-level `await` is only legal at the TypeScript level when the module format is ESM (`es2022`, `esnext`, `node16`, etc.). The startup code used bare top-level `await` outside an `async` function.

**Fix applied** (`src/server.ts`):
```typescript
// Before (invalid in CJS mode):
const app = await buildServer();
await runMigrations(app.log);
await app.listen({ host: getEnv().HOST, port: getEnv().PORT });

// After (wrapped in IIFE):
void (async () => {
  const app = await buildServer();
  process.on('SIGTERM', () => void shutdown(app, 'SIGTERM'));
  process.on('SIGINT',  () => void shutdown(app, 'SIGINT'));
  try {
    await runMigrations(app.log);
    await app.listen({ host: getEnv().HOST, port: getEnv().PORT });
  } catch (err) {
    app.log.error(err, 'Failed to start server');
    process.exit(1);
  }
})();
```

---

#### Run 2: Typecheck after fixes

**Command**: `cd backend && npx tsc --noEmit`  
**Time**: 2026-02-21 ~14:15  
**Result**: ✅ PASS — 0 errors

---

#### Run 3: Drizzle migration generation (deprecated command)

**Command**: `cd backend && npx drizzle-kit generate:sqlite`  
**Time**: 2026-02-21 ~14:20  
**Result**: ❌ FAIL — deprecated command

```
Err: This command is deprecated, please use updated 'generate' command
```

**Fix applied**: Switched to `npx drizzle-kit generate`.

---

#### Run 4: Drizzle `generate` with original config

**Command**: `cd backend && npx drizzle-kit generate`  
**Time**: 2026-02-21 ~14:21  
**Result**: ❌ FAIL — Zod validation error

```
_ZodError: [{"expected":"'postgresql' | 'mysql' | 'sqlite'","path":["dialect"],"message":"Required"}]
```

**Root cause**: `drizzle.config.ts` used the old `driver: 'better-sqlite'` key. drizzle-kit v0.21+ requires `dialect: 'sqlite'` instead.

**Fix applied** (`backend/drizzle.config.ts`):
```typescript
// Before:
driver: 'better-sqlite',

// After:
dialect: 'sqlite',
```

---

#### Run 5: Drizzle migration generation after dialect fix

**Command**: `cd backend && npx drizzle-kit generate`  
**Time**: 2026-02-21 ~14:22  
**Result**: ✅ PASS

```
10 tables
app_shell_settings 14 columns 0 indexes 3 fks
app_widget_instances 7 columns 1 indexes 1 fks
dashboards 9 columns 1 indexes 1 fks
icon_cache_entries 8 columns 0 indexes 1 fks
links_list_items 7 columns 1 indexes 1 fks
placeholder_widgets 12 columns 1 indexes 1 fks
sessions 6 columns 2 indexes 1 fks
uploaded_assets 8 columns 0 indexes 0 fks
user_preferences 5 columns 0 indexes 3 fks
users 7 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_loving_tyrannus.sql
```

**Generated file**: `backend/drizzle/0000_loving_tyrannus.sql`

---

#### Run 6: Backend test run (post-harness scaffold)

**Command**: `cd backend && pnpm test`  
**Time**: 2026-02-21 ~15:00  
**Result**: ❌ FAIL — exit code 1

```
No test files found, exiting with code 1
```

**Root cause**: `vitest.config.ts` set `include: ['tests/**/*.test.ts']`. Phase 2 only scaffolded the test harness infrastructure (`tests/setup.ts`, `tests/helpers/http.ts`) — no `.test.ts` files existed yet. Vitest exits with code 1 on zero matches by default.

**Fix applied** (`backend/vitest.config.ts`):
```typescript
// Added:
passWithNoTests: true,
```

---

#### Run 7: Backend test run after `passWithNoTests`

**Command**: `cd backend && pnpm test`  
**Time**: 2026-02-21 ~15:05  
**Result**: ✅ PASS

```
No test files found, exiting with code 0
```

---

#### Run 8: Backend test helper type-check (discovered separately)

**Command**: `cd backend && npx tsc --module CommonJS --strict … tests/helpers/http.ts`  
**Time**: 2026-02-21 ~15:30  
**Result**: ❌ FAIL — 1 error

| File | Line | Error Code | Message |
|------|------|-----------|---------|
| `tests/helpers/http.ts` | 38 | TS2322 | Type `TestAgent<Test>` is not assignable to type `SuperTest<Test>` — `options` property incompatible |

**Root cause**: `supertest(app.server)` returns `TestAgent<Test>` (a concrete class from `supertest-test-agent`). The `TestApp` interface declared the field as `SuperTest<Test>` (a type alias from the `superagent` namespace in `@types/supertest`). These two types have an incompatible `options` method signature (`url: string` vs `url: URLType`) so TypeScript's structural check fails.

Additionally, `tests/` was excluded from `tsconfig.json` (due to `"rootDir": "src"`) so this error was invisible to the standard `typecheck` script.

**Fix applied** (`tests/helpers/http.ts`):
```typescript
// Before:
import type { SuperTest, Test } from 'supertest';
export interface TestApp {
  request: SuperTest<Test>;
  …
}

// After:
/** The type returned by `supertest(server)` — an agent with HTTP method helpers. */
export type TestRequest = ReturnType<typeof supertest>;
export interface TestApp {
  request: TestRequest;
  …
}
```

**Additional fix**: Created `backend/tsconfig.test.json` so test files are type-checked:
```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",          // widens root to include tests/
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Updated `typecheck` script** (`backend/package.json`):
```json
"typecheck": "tsc --noEmit && tsc --project tsconfig.test.json --noEmit"
```

---

#### Run 9: Full backend typecheck (src + tests) after all fixes

**Command**: `cd backend && pnpm run typecheck`  
**Time**: 2026-02-21 ~15:45  
**Result**: ✅ PASS — 0 errors (src and tests)

---

### Frontend — Phase 2

| Check | Command | Outcome |
|-------|---------|---------|
| Initial typecheck (T036–T039) | `cd frontend && npx tsc --noEmit` | ❌ FAIL — 2 errors (Run 1) |
| Typecheck after fixes | `cd frontend && npx tsc --noEmit` | ✅ PASS — 0 errors (Run 2) |
| Playwright E2E | `playwright test` | ⚠️ SKIPPED — config scaffolded; no specs exist yet |

---

#### Run 1: Initial typecheck after implementing T036–T039

**Command**: `cd frontend && npx tsc --noEmit`  
**Time**: 2026-02-21 ~14:30  
**Result**: ❌ FAIL — 2 errors

| File | Line | Error Code | Message |
|------|------|-----------|---------|
| `src/lib/apiClient.ts` | 59 | TS2769 | `body: BodyInit \| null \| undefined` not assignable to `BodyInit \| null` — `exactOptionalPropertyTypes` violation |
| `src/app/router.tsx` | 25 | TS2742 | Inferred type of `router` cannot be named without a reference to `@remix-run/router` — not portable |

**Root cause — `src/lib/apiClient.ts` TS2769**:  
`tsconfig.base.json` enables `"exactOptionalPropertyTypes": true`. The `fetch()` call spread `body: body !== undefined ? JSON.stringify(body) : undefined` into the options object. With `exactOptionalPropertyTypes`, `undefined` is not assignable to `BodyInit | null` (the type of `RequestInit.body`) — the property must be absent, not explicitly `undefined`.

**Fix applied** (`src/lib/apiClient.ts`):
```typescript
// Before:
const response = await fetch(url, {
  method,
  credentials: 'same-origin',
  headers,
  body: body !== undefined ? JSON.stringify(body) : undefined,
  ...options,
});

// After (only spread body when present):
const response = await fetch(url, {
  method,
  credentials: 'same-origin',
  headers,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  ...options,
});
```

**Root cause — `src/app/router.tsx` TS2742**:  
`createBrowserRouter()` returns a type that includes a reference to `@remix-run/router` (an internal `react-router-dom` dependency). TypeScript cannot name that type in emitted declarations without an explicit import of that internal package, which would be non-portable. The exported `const router` had an inferred type that triggered this error.

**Fix applied** (`src/app/router.tsx`):
```typescript
// Before (exported with inferred type):
export const router = createBrowserRouter([…]);

// After (not exported — only AppRouter function is exported):
/** Internal — not exported to avoid non-portable type inference issues. */
const router = createBrowserRouter([…]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

---

#### Run 2: Frontend typecheck after fixes

**Command**: `cd frontend && npx tsc --noEmit`  
**Time**: 2026-02-21 ~14:45  
**Result**: ✅ PASS — 0 errors

---

#### Playwright E2E — Phase 2

**Status**: ⚠️ SCAFFOLDED — not executed  
**Config file**: `frontend/playwright.config.ts` created (T039)  
**Spec files**: None exist in Phase 2 (E2E specs scheduled for Phase 3+ per tasks.md)  
**Note**: The `webServer` launch hook in `playwright.config.ts` is intentionally commented out during development; manual server startup is documented in quickstart.md.

---

### Phase 2 Errors and Fixes

| # | Location | Type | Severity | Description | Fix |
|---|----------|------|----------|-------------|-----|
| 1 | `backend/src/db/migrate.ts:36` | TS2352 | ❌ Build break | Cast from Drizzle `Db` to `better-sqlite3 Database` — structurally incompatible | Used `getSqliteDb()` directly |
| 2 | `backend/src/server.ts:99,104,105` | TS1378 | ❌ Build break | Top-level `await` in CJS module | Wrapped in async IIFE |
| 3 | `backend/drizzle.config.ts` | Config | ❌ Runtime error | `driver` key deprecated; required `dialect` | Changed to `dialect: 'sqlite'` |
| 4 | `backend/drizzle-kit generate:sqlite` | Config | ❌ Runtime error | Deprecated `generate:sqlite` subcommand | Use `generate` |
| 5 | `backend/vitest.config.ts` | Config | ⚠️ Exit code 1 | Vitest exits 1 when no test files found | Added `passWithNoTests: true` |
| 6 | `backend/tests/helpers/http.ts:38` | TS2322 | ❌ Type error | `TestAgent<Test>` not assignable to `SuperTest<Test>` | Used `ReturnType<typeof supertest>` |
| 7 | `backend/tsconfig.json` | Config | ⚠️ Silent gap | `"rootDir": "src"` excluded `tests/` from type-checking | Added `tsconfig.test.json` + updated `typecheck` script |
| 8 | `frontend/src/lib/apiClient.ts:59` | TS2769 | ❌ Build break | `exactOptionalPropertyTypes` rejects `body: undefined` | Spread `body` conditionally |
| 9 | `frontend/src/app/router.tsx:25` | TS2742 | ❌ Build break | Non-portable inferred type via `@remix-run/router` | Stopped exporting `router`; exported `AppRouter` component only |

---

## Phase 3: User Story 1 — First Run + View Dashboard

**Tasks**: T040–T060, T118–T121  
**Date/Time**: 2026-02-21 (evening session)  
**Purpose**: First-run admin creation, auth (login/logout/me), CSRF, sessions, public bootstrap, dashboard shell.

### Backend — Phase 3

| Check | Command | Outcome |
|-------|---------|---------|
| Backend test run (integration tests) | `cd backend && pnpm test` | ✅ PASS — 39 tests across 5 files |

#### Integration tests added

| File | Covers | Tests |
|------|--------|-------|
| `tests/contract/openapi.test.ts` | T040 | 11 |
| `tests/integration/firstRun.test.ts` | T041 | 5 |
| `tests/integration/auth.test.ts` | T042 | 13 |
| `tests/integration/publicBootstrap.test.ts` | T121 | 8 |
| `tests/integration/rateLimit.test.ts` | T120 | 2 |

**Test cases — `tests/integration/firstRun.test.ts`** (5 tests):
- Returns 422 for invalid username (empty string)
- Returns 422 for too-short password (< 8 chars)
- Returns 422 for missing fields
- Returns 201 + session cookie when no users exist (happy path)
- Returns 409 `FIRST_RUN_COMPLETE` when a user already exists

**Test cases — `tests/integration/auth.test.ts`** (13 tests):
- `POST /api/auth/login`: 200 + user + csrfToken on valid credentials
- `POST /api/auth/login`: sets `homedash_session` cookie
- `POST /api/auth/login`: 401 for wrong password
- `POST /api/auth/login`: 401 for non-existent user
- `POST /api/auth/login`: 422 for missing fields
- `GET /api/auth/me`: 200 + user info when authenticated
- `GET /api/auth/me`: 401 without session cookie
- `GET /api/auth/me`: 401 with invalid session cookie value
- `GET /api/auth/me`: csrfToken is a valid 3-part dotted string
- `POST /api/auth/logout`: 401 without session
- `POST /api/auth/logout`: 403 when CSRF token missing
- `POST /api/auth/logout`: 204 + clears session (subsequent `/me` returns 401)
- `POST /api/auth/logout`: 403 with wrong CSRF token

**Test cases — `tests/integration/publicBootstrap.test.ts`** (8 tests):
- Returns 200
- `firstRunRequired: true` when no users exist
- `firstRunRequired: false` after admin is created
- Shell object contains required fields (`titleText`, `headerHeightPx`, `clockStripEnabled`, `clocks[]`)
- `dashboard` is null when no public default is configured
- `deviceContext: "web"` for desktop User-Agent
- `deviceContext: "mobile"` for mobile User-Agent
- Response has all expected top-level fields

**Test cases — `tests/integration/rateLimit.test.ts`** (2 tests):
- Returns 429 after exceeding login rate limit
- Returns 429 after exceeding first-run rate limit

**Test cases — `tests/contract/openapi.test.ts`** (11 tests):
- OpenAPI YAML file exists at expected path
- File is non-empty (> 100 bytes)
- Contains expected path declarations (`/healthz`, `/readyz`, `/api/public/bootstrap`, `/api/auth/login`, `/api/first-run/admin`, etc.)
- Declares expected component schemas (`Error`, `User`, `ShellSettings`, etc.)
- Runtime: `GET /healthz` responds 200
- Runtime: `GET /readyz` responds 200
- Runtime: `GET /api/public/bootstrap` responds 200 with `firstRunRequired` + `deviceContext`
- Runtime: `POST /api/first-run/admin` with invalid body responds 422 (or 409 if user exists)
- Runtime: `POST /api/auth/login` with missing body responds 401 or 422
- Runtime: `GET /api/auth/me` without session responds 401
- Runtime: `POST /api/auth/logout` without session responds 401

---

### Frontend — Phase 3

| Check | Command | Outcome |
|-------|---------|---------|
| Playwright E2E | `playwright test` | ⚠️ SKIPPED — requires live server (specs written; see below) |

#### E2E specs added

| File | Covers | Tests |
|------|--------|-------|
| `tests/e2e/firstRun.spec.ts` | T043 | 1 |
| `tests/e2e/unauthView.spec.ts` | T044 | 2 |

**Test cases — `tests/e2e/firstRun.spec.ts`** (1 test):
- Redirects to `/first-run`, creates admin via form, lands on dashboard shell with header/main visible; `user-display-name` shows "Admin"
  - Has `test.skip()` guard: skips automatically if server is not running

**Test cases — `tests/e2e/unauthView.spec.ts`** (2 tests):
- `beforeAll`: ensures admin exists (calls `POST /api/first-run/admin`; accepts 201 or 409)
- Shows read-only dashboard shell without redirecting to `/first-run`; header + main visible; `login-link` visible; `logout-button` absent
- Login page accessible from login link; `login-form` visible at `/login`

**Status**: ✅ Specs written. Execution requires a live server (`pnpm dev` in backend + frontend). Playwright run skipped in CI until server harness is wired via `webServer` config.

---

### Phase 3 Errors and Fixes

*No errors recorded. All 39 backend integration tests passed on first run; Playwright specs were scaffolded but not executed (no live server in this phase).*

---

## Phase 4: User Story 2 — Shell Customization + Theme

**Tasks**: T061–T077, T122–T125  
**Date/Time**: 2026-02-21 (evening session)  
**Purpose**: Per-user preferences, global shell settings, logo/favicon upload.

### Backend — Phase 4

| Check | Command | Outcome |
|-------|---------|---------|
| Backend tests — all phases combined | `cd backend && pnpm test` | ✅ PASS — 73 tests across 8 files |
| Backend typecheck (src + tests) | `cd backend && pnpm run typecheck` | ✅ PASS — 0 errors |
| Frontend typecheck | `cd frontend && npx tsc --noEmit` | ✅ PASS — 0 errors |
| Frontend E2E | `playwright test` | ⚠️ SKIPPED — requires live server (specs written; see below) |

**Combined test run** (all phases):  
**Command**: `cd backend && pnpm test`  
**Time**: 2026-02-21 ~18:10

```
Test Files  8 passed (8)
     Tests  73 passed (73)
  Start at  18:10:40
  Duration  6.50s
```

| Test file | Tests | Result |
|-----------|-------|--------|
| `tests/contract/openapi.test.ts` | 11 | ✅ |
| `tests/integration/firstRun.test.ts` | 5 | ✅ |
| `tests/integration/auth.test.ts` | 13 | ✅ |
| `tests/integration/publicBootstrap.test.ts` | 8 | ✅ |
| `tests/integration/rateLimit.test.ts` | 2 | ✅ |
| `tests/integration/adminShell.test.ts` | 14 | ✅ |
| `tests/integration/userPreferences.test.ts` | 11 | ✅ |
| `tests/integration/logoUpload.test.ts` | 9 | ✅ |
| **Total** | **73** | **✅ PASS** |

#### Integration tests added

| File | Covers | Tests |
|------|--------|-------|
| `tests/integration/userPreferences.test.ts` | T061 | 11 |
| `tests/integration/adminShell.test.ts` | T062 | 14 |
| `tests/integration/logoUpload.test.ts` | T063 | 9 |

**Test cases — `tests/integration/userPreferences.test.ts`** (11 tests):
- `GET /api/user/preferences`: 401 when not authenticated
- `GET /api/user/preferences`: 200 + preference fields for authenticated user
- `PUT /api/user/preferences`: 401 when not authenticated
- `PUT /api/user/preferences`: 403 when CSRF token missing
- `PUT /api/user/preferences`: 403 with invalid CSRF token
- Updates `themeMode` to `light` → 200 with `themeMode: "light"`
- Persists preference change: GET after PUT reflects updated value; second PUT restores original
- Rejects unknown fields (strict schema) → 422
- Rejects invalid `themeMode` values → 422
- Accepts partial update (only `themeMode`; `mobileDashboardId` remains null)
- Accepts setting `webDashboardId` to null

**Test cases — `tests/integration/adminShell.test.ts`** (14 tests):
- `GET /api/admin/shell`: 401 for anonymous
- `GET /api/admin/shell`: 200 for admin with expected shell fields
- `GET /api/admin/shell`: includes `unauthWebDashboardId` and `unauthMobileDashboardId` fields (T122)
- `PUT /api/admin/shell`: 401 for anonymous
- `PUT /api/admin/shell`: 403 when CSRF token missing
- Updates `titleText` → 200 with updated value
- Updates `clockStripEnabled` + `headerHeightPx` → 200 with new values
- Updates `footerText` → 200 with new value
- Sets `footerText` to null → 200 with `footerText: null`
- Rejects more than 5 extra timezones → 422
- Accepts up to 5 extra timezones (6 total including home) → 200, clocks array length 6, first clock has `isHome: true`
- Rejects unknown fields (strict mode) → 422
- Sets `unauthWebDashboardId` (T123) → 200 or 422

**Test cases — `tests/integration/logoUpload.test.ts`** (9 tests):
- *Auth*: 401 for anonymous upload attempt
- *Auth*: 403 when CSRF token missing
- Accepts valid PNG → 201 with asset shape (`id`, `contentType`, `byteSize`, `storagePath`)
- Accepts valid JPEG → 201 with `contentType: "image/jpeg"`
- Updates `logoAssetId` in shell settings after upload
- `GET /favicon.ico` returns 200 with `image/png` after upload
- Public bootstrap returns non-null `logoUrl` after upload
- Rejects executable binary (non-image) → 415
- Rejects file > 5 MiB → 413

#### Known non-fatal stderr output in logoUpload tests

During logo upload tests, `sharp` logs warnings to stderr:
```
[assetService] Failed to generate favicon variants: Error: pngload_buffer: libspng read error
[assetService] Failed to generate favicon variants: Error: Input buffer has corrupt header: VipsJpeg: premature end of JPEG image
```

**Cause**: Test fixtures use minimal synthetic binary buffers (not valid image data) for some non-rejection test paths. `sharp` attempts to generate favicon size variants and fails gracefully because the JPEG/PNG headers are incomplete. The error is caught and logged at `warn` level; it does not affect the primary upload or test assertions.  
**Status**: ✅ All 9 tests pass. The favicon generation failure is a best-effort, non-blocking operation per spec (T070). No fix required — logging is the correct mitigation.

---

### Frontend — Phase 4

| Check | Command | Outcome |
|-------|---------|---------|
| Playwright E2E | `playwright test` | ⚠️ SKIPPED — requires live server (specs written; see below) |

#### E2E specs added

| File | Covers | Tests |
|------|--------|-------|
| `tests/e2e/theme.spec.ts` | T064 | 2 |
| `tests/e2e/shellSettings.spec.ts` | T065 | 3 |

**Test cases — `tests/e2e/theme.spec.ts`** (2 tests):
- Unauthenticated: toggling theme persists in `localStorage` after page reload
- Authenticated admin: toggling theme updates server-side preference, persists after reload; reverts after test

**Test cases — `tests/e2e/shellSettings.spec.ts`** (3 tests):
- Admin: updating `titleText` → header visually reflects new title
- Admin: updating `footerText` → footer visually reflects new text
- Admin: enabling clock strip → `clock-home` test-id element becomes visible

All three tests include a `test.skip()` guard that skips automatically when no running server is detected.

**Status**: ✅ Specs written. Execution requires a live server.

---

### Phase 4 Errors and Fixes

*No errors recorded in automated tests. Three runtime bugs were discovered during Docker-based human testing (Phase 5) and fixed before the Phase 5 build re-run.*

---

## Phase 5: Build & Integration Validation

**Tasks**: Cross-phase validation — Phases 1–4  
**Date/Time**: 2026-02-22  
**Purpose**: End-to-end Docker build validation of the compiled production image, followed by live human testing. Covers all implemented phases (1–4).

| Check | Command | Outcome |
|-------|---------|---------|
| Docker build (Run 1 — pre-fix) | `docker build --tag homedash:phase4-validation --progress=plain .` | ✅ BUILD SUCCESS |
| Startup: `GET /healthz` | manual HTTP | ✅ PASS — `{"status":"ok"}` |
| Startup: `GET /readyz` | manual HTTP | ✅ PASS — `{"status":"ok"}` |
| Startup: `GET /api/public/bootstrap` | manual HTTP | ⚠️ shell was null (Bug 1) |
| Human testing Run 1: First-run form submit | manual | ❌ FAIL — stayed on `/first-run` (Bug 2) |
| Human testing Run 1: Theme toggle | manual | ❌ FAIL — no visible change (Bug 3) |
| Human testing Run 1: Shell Settings → Save | manual | ❌ FAIL — 500 server error (Bug 1) |
| Docker build (Run 2 — post-fix) | `docker build --tag homedash:phase4-validation --progress=plain .` | ✅ BUILD SUCCESS |
| TypeScript compile (frontend) | `pnpm -C frontend build` (tsc + Vite) | ✅ PASS — 0 errors; 92 modules |
| TypeScript compile (backend) | `pnpm -C backend build` (tsup) | ✅ PASS — 53.64 KB CJS bundle |
| Human testing Run 2: First-run form submit | manual | ✅ PASS |
| Human testing Run 2: Theme toggle | manual | ✅ PASS |
| Human testing Run 2: Shell Settings → Save | manual | ✅ PASS |
| Post-validation teardown | `docker stop / rm / rmi` | ✅ PASS |

---

### Build — Run 1 (pre-fix)

**Command**: `docker build --tag homedash:phase4-validation --progress=plain .`  
**Image tag**: `homedash:phase4-validation`  
**Docker version**: 29.2.1  
**Result**: ✅ BUILD SUCCESS

| Stage | Result | Notes |
|-------|--------|-------|
| `builder` — `pnpm install --frozen-lockfile` | ✅ | 805 packages installed; `argon2` and `better-sqlite3` native addons compiled for Linux/Alpine |
| `builder` — `pnpm -C frontend build` | ✅ | `tsc --noEmit` clean; Vite: 92 modules transformed, 287 kB output (gzip 90 kB) |
| `builder` — `pnpm -C backend build` | ✅ | `tsup`: 53.64 KB CJS bundle + `.d.ts` declarations |
| `production` — layer copy | ✅ | `frontend/dist`, `backend/dist`, `drizzle/`, `node_modules` all copied |
| Final image size | ✅ | **120.9 MB** |

**Startup verification**:
- `GET /healthz` → `{"status":"ok"}` ✅
- `GET /readyz` → `{"status":"ok"}` ✅
- `GET /api/public/bootstrap` → `{"firstRunRequired":true,"shell":null,...}` ⚠️ shell was null (seed not yet running — see Bug 1 below)

---

### Human Testing — Run 1 (bugs found)

**Tester**: Human (project owner)  
**Date/Time**: 2026-02-22  
**Container**: `homedash-phase4-test`, port `3030`

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| First-run form submit | Redirected to `/` (dashboard) | Stayed on `/first-run` | ❌ FAIL |
| Theme toggle (light ↔ dark) | Visual colour change | No visible change | ❌ FAIL |
| Shell Settings → Save | 200, settings persisted | `"Failed to save. Check inputs."` (500 server error) | ❌ FAIL |

---

#### Bug 1 — Shell settings 500 (`getShellSettings`: singleton not found)

**Symptom**: Every request to `GET /api/admin/shell` and `PUT /api/admin/shell` returned HTTP 500 with `"Shell settings singleton not found — run seed first"`.

**Root cause** (`backend/src/server.ts`):  
`server.ts` contains two separate async entry points:
1. A `main()` function (exported, but never called at runtime) — correctly calls `runMigrations → seedDatabase → app.listen`.
2. The actual IIFE guarded by `process.env['NODE_ENV'] !== 'test'` — only called `runMigrations → app.listen`, **missing the `seedDatabase()` call**.

Because the IIFE is the real startup path, `seedDatabase()` was never invoked, so the `app_shell_settings` singleton row was never inserted. Every shell settings access then threw.

**Fix** (`backend/src/server.ts` — IIFE):
```typescript
// Before (missing seedDatabase):
await runMigrations(app.log);
await app.listen({ host: getEnv().HOST, port: getEnv().PORT });

// After (seed added):
await runMigrations(app.log);
await seedDatabase(app.log);
await app.listen({ host: getEnv().HOST, port: getEnv().PORT });
```

**Verification**: After fix, startup logs show:
```
{"msg":"DB migrations complete"}
{"msg":"Seeded: app_shell_settings singleton created"}
{"msg":"Seeded: starter dashboard created (id=...)"}
{"msg":"Server listening at http://0.0.0.0:3000"}
```
`GET /api/public/bootstrap` now returns `"shell": { "titleText": "HomeDash", ... }` ✅

---

#### Bug 2 — No redirect after first-run form submit

**Symptom**: After successfully creating the admin account, the browser remained on `/first-run` and did not navigate to the dashboard.

**Root cause** (`frontend/src/pages/FirstRunPage.tsx`):  
After a successful `POST /api/first-run/admin`, `FirstRunPage` called:
```typescript
await queryClient.invalidateQueries({ queryKey: bootstrapKeys.public });
await queryClient.invalidateQueries({ queryKey: bootstrapKeys.me });
navigate('/', { replace: true });
```
`invalidateQueries` marks the cached query as stale and returns **immediately without waiting for a refetch**. When `navigate('/')` fires, `DashboardPage` mounts and calls `useBootstrap()`, which reads the **still-cached stale value** of `firstRunRequired: true`. The `useEffect` guard in `DashboardPage` then redirects back to `/first-run`, creating a loop.

**Fix** (`frontend/src/pages/FirstRunPage.tsx`):  
Replace `invalidateQueries` with `removeQueries` to evict the stale cache entries entirely. `DashboardPage` then fetches fresh data (returning `firstRunRequired: false`) and renders correctly.
```typescript
// Before:
await queryClient.invalidateQueries({ queryKey: bootstrapKeys.public });
await queryClient.invalidateQueries({ queryKey: bootstrapKeys.me });

// After:
queryClient.removeQueries({ queryKey: bootstrapKeys.public });
queryClient.removeQueries({ queryKey: bootstrapKeys.me });
```

---

#### Bug 3 — Theme toggle produces no visual change

**Symptom**: Clicking the sun/moon toggle button appeared to do nothing. The page remained dark regardless of the selected mode.

**Root cause** (multiple files — `ShellLayout.tsx`, `ThemeToggle.tsx`, `DashboardPage.tsx`, `index.html`):

The toggle mechanism itself was working correctly:
- `applyTheme()` correctly toggled `document.documentElement.classList` between `.dark` and no class.
- `localStorage` was being updated (confirmed in browser DevTools).
- `PUT /api/user/preferences` returned 200 (confirmed in server logs).
- Tailwind `darkMode: 'class'` was correctly configured.

However, **all layout components used hardcoded dark-only Tailwind classes** (`bg-gray-950`, `bg-gray-900`, `text-gray-100`) without any `dark:` prefix variants. Toggling the `dark` class on `<html>` had no visual effect because no element had a contrasting light-mode class defined.

Additionally, `index.html` had no theme initialiser, causing a brief flash of light-mode styles before React mounted and called `useInitTheme()`.

**Fix** (4 files):

*`frontend/index.html`* — inline theme initialiser added to `<head>` to apply `dark` class before React mounts:
```html
<script>
  try {
    if (localStorage.getItem('homedash_theme') !== 'light') {
      document.documentElement.classList.add('dark');
    }
  } catch (_) {}
</script>
```

*`frontend/src/components/ShellLayout.tsx`* — key elements updated to use `dark:` variants:
- Root wrapper: `bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100`
- Header: `border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900`
- Title text: `text-gray-900 dark:text-white`
- Login link hover: light/dark contrast classes
- Clock strip wrapper: `bg-gray-50 dark:bg-gray-900/50`
- Footer: `border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900`

*`frontend/src/components/ThemeToggle.tsx`* — button hover states updated:
- `text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white`

*`frontend/src/pages/DashboardPage.tsx`* — loading div and dashboard content card updated with light/dark classes.

---

### Build — Run 2 (post-fix)

**Command**: `docker build --tag homedash:phase4-validation --progress=plain .`  
**Result**: ✅ BUILD SUCCESS (dependency layers cached; only source layers rebuilt)

**TypeScript compile verification** (both workspaces): ✅ 0 errors  
**Frontend Vite build**: ✅ 92 modules transformed  
**Backend tsup build**: ✅ 53.64 KB CJS bundle

**Startup verification** (fresh DB volume):
- `GET /healthz` → `{"status":"ok"}` ✅
- `GET /readyz` → `{"status":"ok"}` ✅
- `GET /api/public/bootstrap` → `{"firstRunRequired":true,"shell":{"titleText":"HomeDash",...},...}` ✅ shell now populated

---

### Human Testing — Run 2 (COMPLETED)

**Container**: `homedash-phase4-test` (rebuilt), port `3030`  
**Status**: ✅ Human sign-off confirmed — all 3 bugs resolved

| Test | Expected | Status |
|------|----------|--------|
| First-run form submit → redirect to dashboard | Navigate to `/` automatically after admin creation | ✅ PASS |
| Theme toggle light ↔ dark | Visible colour shift (white bg ↔ dark bg) | ✅ PASS |
| Shell Settings → Save | Settings persist, no 500 error | ✅ PASS |
| Overall shell settings form | All fields editable and saved | ✅ PASS |

---

### Post-Validation Teardown

Performed after human sign-off:

```sh
docker stop homedash-phase4-test    # ✅
docker rm homedash-phase4-test      # ✅
docker volume rm homedash-phase4-data  # ✅
docker rmi homedash:phase4-validation  # ✅
```

---

### Phase 5 Errors and Fixes

| # | Bug | Location | Root Cause | Fix |
|---|-----|----------|------------|-----|
| 1 | Shell settings 500 on every request | `backend/src/server.ts` (startup IIFE) | `seedDatabase()` missing from the actual runtime startup path; singleton row never inserted | Added `await seedDatabase(app.log)` to startup IIFE |
| 2 | No redirect after first-run form submit | `frontend/src/pages/FirstRunPage.tsx` | `invalidateQueries` returns immediately; `DashboardPage` sees stale `firstRunRequired: true` and loops back to `/first-run` | Changed to `removeQueries` to evict cache entirely before navigating |
| 3 | Theme toggle produces no visual change | `ShellLayout.tsx`, `ThemeToggle.tsx`, `DashboardPage.tsx`, `index.html` | All Tailwind classes were hardcoded dark-only; no `dark:` variant counterparts; no FOUC-prevention inline script | Added `dark:` variant classes throughout + inline theme initialiser in `index.html` |

---

## Phase 6: Clock Strip UX Overhaul

**Tasks**: Post-Phase-5 improvements (spec updates FR-011, FR-011a, FR-011b, FR-012, FR-012a)  
**Date/Time**: Post Phase 5 validation  
**Purpose**: Clock strip UX overhaul — new DB column (`clockStripAlignment`), new UI components, FontAwesome icons, spec updates.

| Check | Command | Outcome |
|-------|---------|---------|
| Frontend typecheck | `cd frontend && tsc --noEmit` | ✅ PASS — 0 errors |
| Backend typecheck (src + tests) | `cd backend && tsc --noEmit && tsc --project tsconfig.test.json --noEmit` | ✅ PASS — 0 errors |
| Backend test run | `cd backend && pnpm test` | ✅ PASS — 73/73 |

---

### Changes Implemented

#### Clock Strip UI Overhaul

| File | Change |
|------|--------|
| `backend/src/db/schema/index.ts` | Added `clockStripAlignment` column (`'left' \| 'center' \| 'right'`, default `'center'`) |
| `backend/drizzle/0001_rare_pestilence.sql` | Migration: `ALTER TABLE app_shell_settings ADD clock_strip_alignment TEXT DEFAULT 'center' NOT NULL` |
| `backend/src/services/shellSettingsService.ts` | Updated `ShellSettingsData`, `UpdateShellSettingsInput`, get/update logic |
| `backend/src/api/admin.ts` | Added `clockStripAlignment` to `ShellSettingsUpdateSchema` (Zod) |
| `backend/src/api/public.ts` | Added `clockStripAlignment` to public bootstrap payload |
| `frontend/src/state/bootstrap.ts` | Added `clockStripAlignment` to `ShellSettings` type |
| `frontend/src/state/settings.ts` | Added `clockStripAlignment` to `ShellSettingsAdmin` and `ShellSettingsUpdateInput` |
| `frontend/src/components/ClockStrip.tsx` | **Full rewrite**: HH:MM only (no seconds), FA `faHouse` on home clock, `faSun`/`faMoon` day/night indicator (06:00–17:59 = sun), minute-aligned tick, `alignment` prop |
| `frontend/src/components/ShellLayout.tsx` | Extracts `clockStripAlignment` from bootstrap, passes to `<ClockStrip>` |
| `frontend/src/pages/SettingsPage.tsx` | Clock section replaced: `ToggleSwitch` (ARIA `role="switch"`), `AlignmentPicker` (3-button left/center/right), `TimezoneCombobox` (datalist + IANA), `ExtraTimezoneRow` (up to 5 extra clocks with label + TZ) |
| `specs/001-homelab-dashboard/spec.md` | Updated FR-011, FR-012; added FR-011a, FR-011b, FR-012a; added FontAwesome dependency note |

#### New Dependency

- `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/react-fontawesome` added to `frontend/package.json` (open-source MIT/CC-BY-4.0, bundled at build time — no CDN required)

---

### Backend Test Run (Phase 6)

**Command**: `cd backend && pnpm test` (Vitest 1.6.1)

| Test File | Tests | Status |
|-----------|-------|--------|
| `tests/integration/logoUpload.test.ts` | 9 | ✅ PASS |
| `tests/integration/adminShell.test.ts` | 14 | ✅ PASS |
| `tests/integration/userPreferences.test.ts` | 11 | ✅ PASS |
| `tests/integration/auth.test.ts` | 13 | ✅ PASS |
| `tests/contract/openapi.test.ts` | 11 | ✅ PASS |
| `tests/integration/firstRun.test.ts` | 5 | ✅ PASS |
| `tests/integration/publicBootstrap.test.ts` | 8 | ✅ PASS |
| `tests/integration/rateLimit.test.ts` | 2 | ✅ PASS |
| **Total** | **73** | **✅ 73/73 PASS** |

**Duration**: 6.47s  
**Note**: `logoUpload.test.ts` emits `stderr` warnings for favicon generation (synthetic test fixtures are not valid images) — this is expected and does not affect outcomes.

---

### Phase 6 Errors and Fixes

*No errors recorded. All TypeScript checks and backend tests passed on first run.*

---

## Phase 7: UX Polish & Bug Fix

**Tasks**: T131–T139 — Fix logout 500 crash, fix clock config no-op, fix cookie clear options, add `homeClockConfig` DB column + API, rewrite ClockStrip/UserMenu/ShellLayout, add Breadcrumbs, polish SettingsPage.  
**Date/Time**: 2026-Feb-22  
**Purpose**: Post-Phase-6 UX improvements and two critical bug fixes discovered during human testing.

---

### Human Testing — Round 1 (Pre-Fix)

| # | Test Item | Result | Notes |
|---|-----------|--------|-------|
| 1 | App loads at `http://localhost:3000` | ✅ PASS | |
| 2 | First-run flow completes without errors | ✅ PASS | |
| 3 | Login / logout cycle works | ❌ FAIL | Logout returned 500; session persisted |
| 4 | Home clock displays correctly | ✅ PASS | |
| 5 | Clock display config changes applied | ❌ FAIL | Config changes had no effect on display |
| 6 | Header remains sticky on scroll | ❌ FAIL | Header scrolled away with content |
| 7 | UserMenu opens/closes correctly | ❌ FAIL | Still hover-based; no click dropdown |
| 8 | Breadcrumbs visible on sub-pages | ❌ FAIL | Component not yet implemented |
| 9 | Settings page loads in ShellLayout | ❌ FAIL | Not yet wrapped |
| 10 | Extra timezone rows work | ✅ PASS | Basic add/remove functional |
| 11 | Theme toggle works | ✅ PASS | |
| 12 | Logo/title navigates home | ❌ FAIL | Not a link yet |

---

### Build Check (Pre-Fix)

| Check | Command | Outcome |
|-------|---------|---------|
| Frontend typecheck | `cd frontend && tsc --noEmit` | ❌ FAIL — 2 TS2345 errors (exactOptionalPropertyTypes) |
| Backend typecheck | `cd backend && tsc --noEmit` | ✅ PASS |
| Backend tests | `cd backend && pnpm test` | ✅ PASS — 73/73 |

---

### Phase 7 Errors and Fixes

| # | Location | Error | Fix |
|---|----------|-------|-----|
| 1 | `frontend/src/lib/apiClient.ts` | `Content-Type: application/json` always sent; Fastify strict JSON parser threw `FST_ERR_CTP_EMPTY_JSON_BODY` on bodyless POST → logout returned 500 before session destroy ran | Only set header when `body !== undefined` |
| 2 | `backend/src/api/public.ts` | Bootstrap clock list built from raw DB row without parsing `homeClockConfig` JSON → `Clock.config` always `undefined` → clock display settings silently no-op | Parse JSON, attach `config` to home clock entry |
| 3 | `frontend/src/pages/SettingsPage.tsx` | TS2345: `{ config: ClockDisplayConfig \| undefined }` not assignable to `{ config?: ClockDisplayConfig }` under `exactOptionalPropertyTypes` | Use conditional spread `...(cfg ? { config: cfg } : {})` |
| 4 | `frontend/src/pages/SettingsPage.tsx` | TS2345: `showOffset: boolean \| undefined` not assignable to `boolean` under `exactOptionalPropertyTypes` | Direct boolean assignment with `?? false` default |

---

### Human Testing — Round 2 (Post-Fix)

| # | Test Item | Result | Notes |
|---|-----------|--------|-------|
| 1 | App loads at `http://localhost:3000` | ✅ PASS | |
| 2 | First-run flow completes without errors | ✅ PASS | |
| 3 | Login / logout cycle works | ✅ PASS | Session destroyed; cookie cleared; 401 on re-check |
| 4 | Home clock displays correctly | ✅ PASS | Icon only, no label |
| 5 | Clock display config changes applied | ✅ PASS | Layout/icon/offset changes reflect immediately |
| 6 | Header remains sticky on scroll | ✅ PASS | `h-screen overflow-hidden` + `overflow-y-auto` on main |
| 7 | UserMenu opens/closes correctly | ✅ PASS | Click trigger; outside click and Escape dismiss |
| 8 | Breadcrumbs visible on sub-pages | ✅ PASS | Null on `/`; `border-b` nav on sub-routes |
| 9 | Settings page loads in ShellLayout | ✅ PASS | Two-column layout with sticky sidebar |
| 10 | Extra timezone rows work | ✅ PASS | No per-clock config (simplified); add/remove works |
| 11 | Theme toggle works | ✅ PASS | |
| 12 | Logo/title navigates home | ✅ PASS | Wrapped in `<Link to="/">` |

**Round 2 Result: 12/12 PASS — Phase 07 sign-off ✅**

---

### Build Check (Post-Fix)

| Check | Command | Outcome |
|-------|---------|---------|
| Frontend typecheck | `cd frontend && tsc --noEmit` | ✅ PASS — 0 errors |
| Backend typecheck (src + tests) | `cd backend && tsc --noEmit && tsc --project tsconfig.test.json --noEmit` | ✅ PASS — 0 errors |
| Backend tests | `cd backend && pnpm test` | ✅ PASS — 73/73 |

---

### Docker Build & Validation (Phase 7)

| Step | Command | Outcome |
|------|---------|---------|
| Build image | `docker build -t homedash:test .` | ✅ PASS |
| Run container | `docker run -d --name homedash-test -p 3000:3000 -v /tmp/homedash-test-data:/data homedash:test` | ✅ PASS |
| Healthcheck | `curl -sf http://localhost:3000/healthz` | ✅ PASS — `{"status":"ok"}` |
| Human test round 2 | See table above | ✅ 12/12 PASS |
| Teardown | `docker rm -f homedash-test && docker rmi homedash:test && docker image prune -f && rm -rf /tmp/homedash-test-data` | ✅ PASS |

---

### Files Changed (Phase 7)

| File | Change |
|------|--------|
| `backend/drizzle/0002_clock_config.sql` | **Created** — `ALTER TABLE app_shell_settings ADD COLUMN home_clock_config TEXT` |
| `backend/drizzle/meta/_journal.json` | Added migration entry idx=2 for `0002_clock_config` |
| `backend/src/db/schema/index.ts` | Added `homeClockConfig: text('home_clock_config')` column |
| `backend/src/services/shellSettingsService.ts` | `ClockDisplayConfig` interface; `ClockView.config?`; `ShellSettingsData.homeClockConfig`; parse/serialize JSON |
| `backend/src/api/admin.ts` | `ClockDisplayConfigSchema` (Zod); `homeClockConfig` in `ShellSettingsUpdateSchema` |
| `backend/src/api/auth.ts` | `clearCookie` now passes full matching options (`httpOnly`, `sameSite`, `secure`, `path`) |
| `backend/src/api/public.ts` | Parses `homeClockConfig`; attaches `config` to home clock; extra clocks no longer carry per-clock config |
| `frontend/src/lib/apiClient.ts` | **Bug fix**: `Content-Type` only set when `body !== undefined` |
| `frontend/src/state/bootstrap.ts` | `ClockDisplayConfig` interface; `Clock.config?` |
| `frontend/src/state/settings.ts` | Extended `ShellSettingsAdmin` + `ShellSettingsUpdateInput` with `homeClockConfig` |
| `frontend/src/components/ClockStrip.tsx` | **Rewrite**: `ClockItemRow`/`ClockItemColumn` layouts; global config; centered GMT offset; home clock icon-only |
| `frontend/src/components/UserMenu.tsx` | **Rewrite**: click dropdown; outside-click + Escape dismiss |
| `frontend/src/components/Breadcrumbs.tsx` | **Created** — `border-b` breadcrumb nav for non-root routes |
| `frontend/src/components/ShellLayout.tsx` | Sticky header (`h-screen overflow-hidden`); `<Link>` logo; `<Breadcrumbs />` |
| `frontend/src/pages/DashboardPage.tsx` | `handleLogout`: `queryClient.clear()` + `navigate('/', { replace: true })` |
| `frontend/src/pages/SettingsPage.tsx` | `ShellLayout` wrap; sticky sidebar; `ClockDisplayConfigPicker`; simplified `ExtraTimezoneRow`; same logout pattern |

---

## Cumulative Error Log

| # | Phase | Location | Error | Fix |
|---|-------|----------|-------|-----|
| 1 | 2 | `backend/src/db/migrate.ts` | TS2352: Drizzle `Db` cast to `better-sqlite3 Database` | Use `getSqliteDb()` for raw DB access |
| 2 | 2 | `backend/src/server.ts` | TS1378: top-level `await` in CJS module | Wrap in async IIFE |
| 3 | 2 | `backend/drizzle.config.ts` | Deprecated `driver` key | Replace with `dialect: 'sqlite'` |
| 4 | 2 | `backend/drizzle-kit generate:sqlite` | Deprecated subcommand | Use `generate` |
| 5 | 2 | `backend/vitest.config.ts` | Exit code 1 with zero test files | Add `passWithNoTests: true` |
| 6 | 2 | `backend/tests/helpers/http.ts` | TS2322: `TestAgent<Test>` ≠ `SuperTest<Test>` | Use `ReturnType<typeof supertest>` |
| 7 | 2 | `backend/tsconfig.json` | `tests/` silently excluded from type-checking | Add `tsconfig.test.json`; update `typecheck` script |
| 8 | 2 | `frontend/src/lib/apiClient.ts` | TS2769: `body: undefined` violates `exactOptionalPropertyTypes` | Conditionally spread `body` |
| 9 | 2 | `frontend/src/app/router.tsx` | TS2742: non-portable inferred type via `@remix-run/router` | Stop exporting `router`; export `AppRouter` only |
| 10 | 4 | `logoUpload.test.ts` stderr | `sharp` favicon gen fails on synthetic test buffers | Non-fatal; best-effort by design; no fix needed |
| 11 | 5 | `backend/src/server.ts` (IIFE) | `seedDatabase()` missing from startup path — shell settings singleton never seeded | Added `await seedDatabase(app.log)` to IIFE |
| 12 | 5 | `frontend/src/pages/FirstRunPage.tsx` | `invalidateQueries` race → stale `firstRunRequired: true` loops back to `/first-run` | Changed to `removeQueries` |
| 13 | 5 | `ShellLayout.tsx`, `ThemeToggle.tsx`, `DashboardPage.tsx`, `index.html` | Hardcoded dark-only classes; no `dark:` variants; no FOUC prevention | Added `dark:` variants + inline theme initialiser |
| 14 | 7 | `frontend/src/lib/apiClient.ts` | `Content-Type: application/json` always sent; `FST_ERR_CTP_EMPTY_JSON_BODY` on bodyless POST → logout 500; session not destroyed | Only set `Content-Type` when `body !== undefined` |
| 15 | 7 | `backend/src/api/public.ts` | `homeClockConfig` not parsed from DB row → `Clock.config` always `undefined` → clock display config silently no-op | Parse JSON from DB, attach `config` to home clock in bootstrap response |
| 16 | 7 | `frontend/src/pages/SettingsPage.tsx` | TS2345: `{ config: ClockDisplayConfig \| undefined }` not assignable to `{ config?: ClockDisplayConfig }` (`exactOptionalPropertyTypes`) | Conditional spread `...(cfg ? { config: cfg } : {})` |
| 17 | 7 | `frontend/src/pages/SettingsPage.tsx` | TS2345: `showOffset: boolean \| undefined` not assignable to `boolean` (`exactOptionalPropertyTypes`) | Direct boolean assignment with `?? false` default |
