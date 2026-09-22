# 05 — Phase Build & Integration Validation

[<- Back to Logs Index](readme.md)

## Table of Contents
- [Overview](#overview)
- [Commands Run](#commands-run)
- [Run 1: pnpm-build (Docker build pre-fix)](#run-1-pnpm-build-docker-build-pre-fix)
- [Human Testing Run 1 — Bugs Found](#human-testing-run-1--bugs-found)
- [Bug 1: Shell settings 500 (seed missing from startup)](#bug-1-shell-settings-500-seed-missing-from-startup)
- [Bug 2: No redirect after first-run form submit](#bug-2-no-redirect-after-first-run-form-submit)
- [Bug 3: Theme toggle produces no visual change](#bug-3-theme-toggle-produces-no-visual-change)
- [Run 2: pnpm-build (Docker build post-fix)](#run-2-pnpm-build-docker-build-post-fix)
- [Human Testing Run 2 — Sign-off](#human-testing-run-2--sign-off)
- [Post-Validation Teardown](#post-validation-teardown)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 05 — Build & Integration Validation  
**Task range**: Cross-phase validation — Phases 1–4  
**Date/Time**: 2026-02-22  
**Purpose**: End-to-end Docker build validation of the compiled production image, followed by live human testing. Covers all implemented phases (1–4).

## Commands Run

| # | Command | Outcome | Log File |
|---|---------|---------|----------|
| 1 | `docker build --tag homedash:phase4-validation --progress=plain .` | ✅ BUILD SUCCESS (run 1 — pre-fix) | [05-phase-build-integration-validation/pnpm-build-run-1.log](05-phase-build-integration-validation/pnpm-build-run-1.log) |
| 2 | Human testing run 1: First-run form submit | ❌ FAIL — stayed on `/first-run` | — |
| 3 | Human testing run 1: Theme toggle | ❌ FAIL — no visible change | — |
| 4 | Human testing run 1: Shell Settings → Save | ❌ FAIL — 500 server error | — |
| 5 | `docker build --tag homedash:phase4-validation --progress=plain .` | ✅ BUILD SUCCESS (run 2 — post-fix) | [05-phase-build-integration-validation/pnpm-build-run-2.log](05-phase-build-integration-validation/pnpm-build-run-2.log) |
| 6 | Human testing run 2: First-run form submit | ✅ PASS | — |
| 7 | Human testing run 2: Theme toggle | ✅ PASS | — |
| 8 | Human testing run 2: Shell Settings → Save | ✅ PASS | — |
| 9 | `docker stop / rm / rmi` | ✅ PASS | — |

## Run 1: pnpm-build (Docker build pre-fix)

**Command**: `docker build --tag homedash:phase4-validation --progress=plain .`  
**Time**: 2026-02-22 ~09:00  
**Docker version**: 29.2.1  
**Exit**: 0  

See [05-phase-build-integration-validation/pnpm-build-run-1.log](05-phase-build-integration-validation/pnpm-build-run-1.log).

| Stage | Result | Notes |
|-------|--------|-------|
| `builder` — `pnpm install --frozen-lockfile` | ✅ | 805 packages; `argon2` + `better-sqlite3` native addons compiled for Linux/Alpine |
| `builder` — `pnpm -C frontend build` | ✅ | tsc clean; Vite: 92 modules, 287 kB (gzip 90 kB) |
| `builder` — `pnpm -C backend build` | ✅ | tsup: 53.64 KB CJS bundle + `.d.ts` |
| `production` — layer copy | ✅ | `frontend/dist`, `backend/dist`, `drizzle/`, `node_modules` all copied |
| Final image size | ✅ | **120.9 MB** |

**Startup verification**:
- `GET /healthz` → `{"status":"ok"}` ✅
- `GET /readyz` → `{"status":"ok"}` ✅
- `GET /api/public/bootstrap` → shell was `null` ⚠️ (Bug 1 — seed not running)

## Human Testing Run 1 — Bugs Found

**Tester**: Human (project owner)  
**Container**: `homedash-phase4-test`, port `3030`

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| First-run form submit | Redirect to `/` | Stayed on `/first-run` | ❌ FAIL |
| Theme toggle (light ↔ dark) | Visual colour change | No visible change | ❌ FAIL |
| Shell Settings → Save | 200, settings persisted | `"Failed to save."` (500 server error) | ❌ FAIL |

## Bug 1: Shell settings 500 (seed missing from startup)

**Symptom**: Every request to `GET /api/admin/shell` and `PUT /api/admin/shell` returned HTTP 500 with `"Shell settings singleton not found — run seed first"`.

**Root cause** (`backend/src/server.ts`): The startup IIFE (the actual runtime path) only called `runMigrations → app.listen`, **missing `seedDatabase()`**. A separate `main()` function correctly called all three steps but was never invoked at runtime.

**Fix** (`backend/src/server.ts` — IIFE):
```typescript
// Before:
await runMigrations(app.log);
await app.listen({ host: getEnv().HOST, port: getEnv().PORT });

// After:
await runMigrations(app.log);
await seedDatabase(app.log);
await app.listen({ host: getEnv().HOST, port: getEnv().PORT });
```

**Verification** (post-fix startup logs):
```
{"msg":"DB migrations complete"}
{"msg":"Seeded: app_shell_settings singleton created"}
{"msg":"Seeded: starter dashboard created (id=...)"}
{"msg":"Server listening at http://0.0.0.0:3000"}
```

## Bug 2: No redirect after first-run form submit

**Symptom**: After successfully creating the admin account, the browser remained on `/first-run` instead of navigating to the dashboard.

**Root cause** (`frontend/src/pages/FirstRunPage.tsx`): After `POST /api/first-run/admin` succeeded, `invalidateQueries` was called then `navigate('/')`. `invalidateQueries` marks the query stale and returns immediately — it does not wait for a refetch. `DashboardPage` then read the stale cache (still `firstRunRequired: true`) and redirected back to `/first-run`, creating a loop.

**Fix**: Replace `invalidateQueries` with `removeQueries` to evict the stale cache entirely:
```typescript
// Before:
await queryClient.invalidateQueries({ queryKey: bootstrapKeys.public });
await queryClient.invalidateQueries({ queryKey: bootstrapKeys.me });

// After:
queryClient.removeQueries({ queryKey: bootstrapKeys.public });
queryClient.removeQueries({ queryKey: bootstrapKeys.me });
```

## Bug 3: Theme toggle produces no visual change

**Symptom**: Clicking the theme toggle appeared to do nothing. The page remained dark.

**Root cause** (4 files): The toggle mechanism worked correctly (localStorage updated, API returned 200, `dark` class toggled on `<html>`). However, **all layout components used hardcoded dark-only Tailwind classes** without `dark:` prefix variants. Toggling the `dark` class had no visual effect. Also, `index.html` had no inline FOUC-prevention script.

**Fix** (4 files):

- `frontend/index.html` — inline theme initialiser in `<head>`:
  ```html
  <script>try { if (localStorage.getItem('homedash_theme') !== 'light') { document.documentElement.classList.add('dark'); } } catch (_) {}</script>
  ```
- `frontend/src/components/ShellLayout.tsx` — root, header, clock strip, title, footer all given light/dark `dark:` variants.
- `frontend/src/components/ThemeToggle.tsx` — button hover states updated with light/dark classes.
- `frontend/src/pages/DashboardPage.tsx` — loading div and content card given `dark:` variants.

## Run 2: pnpm-build (Docker build post-fix)

**Command**: `docker build --tag homedash:phase4-validation --progress=plain .`  
**Time**: 2026-02-22 ~10:30  
**Exit**: 0  

Dependency layers cached (only source layers rebuilt). See [05-phase-build-integration-validation/pnpm-build-run-2.log](05-phase-build-integration-validation/pnpm-build-run-2.log).

- Frontend Vite build: ✅ 92 modules transformed  
- Backend tsup build: ✅ 53.64 KB CJS bundle  
- TypeScript: ✅ 0 errors  
- Startup: `GET /api/public/bootstrap` → shell now populated ✅

## Human Testing Run 2 — Sign-off

**Container**: `homedash-phase4-test` (rebuilt), port `3030`  
**Status**: ✅ Human sign-off confirmed — all 3 bugs resolved

| Test | Status |
|------|--------|
| First-run form submit → redirect to dashboard | ✅ PASS |
| Theme toggle light ↔ dark (visual colour shift) | ✅ PASS |
| Shell Settings → Save (persist, no 500) | ✅ PASS |
| Overall shell settings form (all fields editable) | ✅ PASS |

## Post-Validation Teardown

```sh
docker stop homedash-phase4-test    # ✅
docker rm homedash-phase4-test      # ✅
docker volume rm homedash-phase4-data  # ✅
docker rmi homedash:phase4-validation  # ✅
```

## Errors & Fixes

| # | Bug | Location | Root Cause | Fix |
|---|-----|----------|------------|-----|
| 1 | Shell settings 500 on every request | `backend/src/server.ts` (startup IIFE) | `seedDatabase()` missing from runtime startup path | Added `await seedDatabase(app.log)` before `app.listen` |
| 2 | No redirect after first-run form submit | `frontend/src/pages/FirstRunPage.tsx` | `invalidateQueries` returns immediately; stale cache causes re-redirect loop | Changed to `removeQueries` to evict cache |
| 3 | Theme toggle produces no visual change | `ShellLayout.tsx`, `ThemeToggle.tsx`, `DashboardPage.tsx`, `index.html` | Hardcoded dark-only Tailwind classes; no `dark:` variants; no FOUC prevention | Added `dark:` variant classes + inline `<head>` theme initialiser |

## Phase Checkpoint

✅ **PASS** — Docker image builds cleanly; all 3 runtime bugs fixed before sign-off; human testing passed. Feature implementation complete through Phase 4. Proceed to Phase 6 (post-phase enhancements).
