# 07 — Phase UX Polish & Bug Fix

[<- Back to Logs Index](readme.md)

## Table of Contents
- [Overview](#overview)
- [Commands Run](#commands-run)
- [Human Testing Round 1 — Bugs Found](#human-testing-round-1--bugs-found)
- [Bug 1: Logout POST crashes with 500](#bug-1-logout-post-crashes-with-500)
- [Bug 2: Clock display config not applied](#bug-2-clock-display-config-not-applied)
- [FR Changes: Clock strip display consolidation](#fr-changes-clock-strip-display-consolidation)
- [FR Changes: Navigation & layout polish](#fr-changes-navigation--layout-polish)
- [Run 1: Docker build & validation (pre-fix)](#run-1-docker-build--validation-pre-fix)
- [Human Testing Round 2 — Sign-off](#human-testing-round-2--sign-off)
- [Post-Validation Teardown](#post-validation-teardown)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

---

## Overview

**Phase**: 07 — UX Polish & Bug Fix  
**Task range**: Post-Phase-6 improvements (new FRs, bug fixes, DB migration `0002`)  
**Date/Time**: 2026-02-22 (evening session)  
**Purpose**: Addressed a batch of UX feedback and two bugs discovered after Phase 6 sign-off. Covered auth flow (logout), navigation (sticky header, breadcrumbs, header link), settings page layout (sidebar, ShellLayout wrap), timezone combobox (UTC, help link), user menu (dropdown), and clock strip display configuration.

---

## Commands Run

| # | Command | Outcome | Notes |
|---|---------|---------|-------|
| 1 | `docker build -t homedash:test .` | ✅ BUILD (run 1 — pre-FR changes) | Initial validation of Phase 6 state |
| 2 | Human testing round 1 | ❌ BUGS FOUND — see below | Logout 500, clock config no-op |
| 3 | `docker build -t homedash:test .` | ❌ FAIL — TS `exactOptionalPropertyTypes` (2 errors) | `SettingsPage.tsx` config spread |
| 4 | `docker build -t homedash:test .` | ✅ BUILD SUCCESS (run 2 — post-fix) | After type error fixes |
| 5 | Human testing round 2 | ✅ PASS — all items verified | See sign-off below |
| 6 | `docker rm -f homedash-test && docker rmi homedash:test && docker image prune -f` | ✅ PASS | Teardown complete |

---

## Human Testing Round 1 — Bugs Found

Container: `homedash-test`, port 3000, data volume `/tmp/homedash-test-data`.

| # | Test | Result | Root Cause |
|---|------|--------|------------|
| 1 | Click Logout | ❌ FAIL — 500 from `/api/auth/logout` | `apiClient` always sent `Content-Type: application/json`; Fastify strict parser rejected empty body |
| 2 | Clock strip display settings | ❌ FAIL — layout/offset changes had no effect | `public.ts` never read `homeClockConfig` from DB — clocks returned without `config` field |
| 3 | Header absent on Settings page | ❌ FAIL | `SettingsPage` used its own layout, not `ShellLayout` |
| 4 | Header scrolled out of view | ❌ FAIL | Outer container was `min-h-screen` (page scrolls) instead of `h-screen overflow-hidden` (only main scrolls) |

---

## Bug 1: Logout POST crashes with 500

**Root cause**: `apiClient.ts` unconditionally added `Content-Type: application/json` to every POST, including those with no body. Fastify's strict JSON body parser threw `FST_ERR_CTP_EMPTY_JSON_BODY` before the route handler ran, so `destroySession()` was never called and the session cookie persisted.

**Symptoms**:
- Browser: clicking Logout appeared to redirect but user remained logged in
- Server log: `FastifyError: Body cannot be empty when content-type is set to 'application/json'` → HTTP 500

**Fix**:
- `frontend/src/lib/apiClient.ts`: Only set `Content-Type: application/json` when `body !== undefined`
- `backend/src/api/auth.ts`: `clearCookie` now passes the full matching cookie options (`httpOnly: true`, `sameSite: 'lax'`, `secure`) so the browser correctly removes the cookie
- `frontend/src/pages/DashboardPage.tsx` + `frontend/src/pages/SettingsPage.tsx`: Post-logout navigation changed from `navigate('/login')` to `navigate('/')` and from `queryClient.invalidateQueries` to `queryClient.clear()` so all stale auth state is evicted before re-render

**Verification**: `curl -X POST http://localhost:3000/api/auth/logout` (no Content-Type) → HTTP 401 (auth required, no crash). Full login → logout → `/api/auth/me` round trip → 401 (session destroyed).

---

## Bug 2: Clock display config not applied

**Root cause**: `backend/src/api/public.ts` built the clock list by hand from raw DB columns without parsing `homeClockConfig`. The `config` field was never attached to any clock object in the bootstrap response, so `ClockStrip` always received `clock.config = undefined` and fell back to defaults.

**Fix**:
- `backend/src/api/public.ts`: Parse `homeClockConfig` JSON; attach full config to home clock; forward it as the global display config to all clocks
- `frontend/src/components/ClockStrip.tsx`: `ClockItem` derives `globalCfg` from the home clock's `config`; all clocks render using that config uniformly (`showOffset` is global)

---

## FR Changes: Clock strip display consolidation

Per user feedback, per-clock display config was simplified:

| Change | Detail |
|--------|--------|
| Layout, icon sides, label override | Global — controlled by home clock config only |
| `showOffset` (GMT±offset) | Global — single toggle for all clocks; removed per-clock checkbox |
| Home clock label | Removed from display — house icon is the only identifier |
| GMT offset rendering | Centered under the time in both `column` and `row` layouts |

DB: New migration `backend/drizzle/0002_clock_config.sql` — `ALTER TABLE app_shell_settings ADD COLUMN home_clock_config TEXT`.

---

## FR Changes: Navigation & layout polish

| Area | Change |
|------|--------|
| **Logout** | Now calls `queryClient.clear()` and navigates to `/` (public dashboard) instead of `/login` |
| **Header** | Outer shell container changed from `min-h-screen` (page-level scroll) to `h-screen overflow-hidden` — only `<main>` scrolls via `overflow-y-auto`; header is always visible on every page |
| **Header logo/title** | Wrapped in `<Link to="/">` — clicking navigates to dashboard |
| **UserMenu** | Converted from always-visible inline buttons to a click-triggered dropdown (avatar + chevron); closes on outside click or Escape |
| **Breadcrumbs** | New `Breadcrumbs` component renders a `border-b` nav bar below the header chrome on all non-root routes |
| **Settings page layout** | `SettingsPage` now wraps in `ShellLayout` (consistent header, clock strip, breadcrumbs); two-column layout with sticky left sidebar jump-links |
| **Timezone combobox** | `UTC` always prepended to IANA list; Wikipedia help link added below each timezone input |

---

## Run 1: Docker build & validation (pre-fix)

**Command**: `docker build --progress=plain -t homedash:test .`

Initial build from Phase 6 state passed. Container started healthy. Bugs discovered during human testing.

After implementing all fixes, a rebuild attempt failed with two `exactOptionalPropertyTypes` errors in `SettingsPage.tsx`:

| Error | File | Fix |
|-------|------|-----|
| `TS2345`: spread of `{ config: ClockDisplayConfig \| undefined }[]` not assignable to `{ config?: ClockDisplayConfig }[]` | `SettingsPage.tsx` useEffect map | Conditional spread: `...(c.config !== undefined ? { config: c.config } : {})` |
| `TS2345`: `boolean \| undefined` not assignable to `boolean` | `SettingsPage.tsx` ClockDisplayConfigPicker | Assigned `showOffset` directly as `boolean`, removed `|| undefined` |

Both fixed. Second build passed cleanly.

---

## Human Testing Round 2 — Sign-off

Container: `homedash-test`, port 3000.

| # | Test | Result |
|---|------|--------|
| 1 | Logout clears session and redirects to `/` | ✅ PASS |
| 2 | Clock strip layout (Horizontal/Stacked) applies immediately after save | ✅ PASS |
| 3 | GMT± offset toggle applies to all clocks | ✅ PASS |
| 4 | Home clock shows icon only (no text label) | ✅ PASS |
| 5 | Header visible and fixed on Settings page | ✅ PASS |
| 6 | Header does not scroll out of view on any page | ✅ PASS |
| 7 | Header logo/title navigates to `/` | ✅ PASS |
| 8 | UserMenu dropdown opens/closes on click | ✅ PASS |
| 9 | Breadcrumbs appear below header on non-root routes | ✅ PASS |
| 10 | Settings page left sidebar visible with jump-links | ✅ PASS |
| 11 | UTC appears in timezone selection list | ✅ PASS |
| 12 | Wikipedia help link present on timezone inputs | ✅ PASS |

**Sign-off**: Human testing ✅ complete. All 12 items verified.

---

## Post-Validation Teardown

| Command | Outcome |
|---------|---------|
| `docker rm -f homedash-test` | ✅ Container removed |
| `docker rmi homedash:test` | ✅ Image removed |
| `docker image prune -f` | ✅ Dangling layers cleared |
| `rm -rf /tmp/homedash-test-data` | ✅ Test data volume removed |

---

## Errors & Fixes

| # | Location | Error | Fix |
|---|----------|-------|-----|
| 1 | `frontend/src/lib/apiClient.ts` | `Content-Type: application/json` on bodyless POST → Fastify 500 | Only set header when `body !== undefined` |
| 2 | `backend/src/api/public.ts` | `homeClockConfig` not parsed → `config` absent from bootstrap clocks | Parse JSON, attach to home clock |
| 3 | `frontend/src/pages/SettingsPage.tsx` | `TS2345` `exactOptionalPropertyTypes` — config spread | Conditional spread + direct boolean |
| 4 | `frontend/src/pages/SettingsPage.tsx` | `TS2345` `exactOptionalPropertyTypes` — showOffset type | Removed `|| undefined` suffix |

---

## Phase Checkpoint

✅ **PASS** — 2 runtime bugs fixed; 12/12 human test items verified; Docker teardown complete.

### Files Modified

| File | Change |
|------|--------|
| `backend/drizzle/0002_clock_config.sql` | New migration: `home_clock_config TEXT` column |
| `backend/drizzle/meta/_journal.json` | Migration journal entry for `0002_clock_config` |
| `backend/src/db/schema/index.ts` | Added `homeClockConfig` column |
| `backend/src/services/shellSettingsService.ts` | `ClockDisplayConfig` type; parse/serialize `homeClockConfig`; `ClockView.config` |
| `backend/src/api/admin.ts` | `ClockDisplayConfigSchema` (Zod); `homeClockConfig` in `ShellSettingsUpdateSchema` |
| `backend/src/api/auth.ts` | `clearCookie` with full matching options |
| `backend/src/api/public.ts` | Parse `homeClockConfig`; attach global config to home clock in bootstrap |
| `frontend/src/lib/apiClient.ts` | Conditional `Content-Type` header |
| `frontend/src/state/bootstrap.ts` | `ClockDisplayConfig` type; `Clock.config` |
| `frontend/src/state/settings.ts` | `ClockDisplayConfig` import; `ShellSettingsAdmin.homeClockConfig`; `ShellSettingsUpdateInput` |
| `frontend/src/components/ClockStrip.tsx` | Global config dispatch; `ClockItemRow`; `ClockItemColumn`; GMT offset centered; home label removed |
| `frontend/src/components/UserMenu.tsx` | Click-triggered dropdown with outside-click/Escape dismiss |
| `frontend/src/components/Breadcrumbs.tsx` | New component — breadcrumb nav for non-root routes |
| `frontend/src/components/ShellLayout.tsx` | `h-screen overflow-hidden` layout; `Link` on logo/title; `Breadcrumbs` |
| `frontend/src/pages/DashboardPage.tsx` | `queryClient.clear()` + navigate `/` on logout |
| `frontend/src/pages/SettingsPage.tsx` | `ShellLayout` wrap; sidebar; `handleLogout`; UTC; help link; `ClockDisplayConfigPicker`; global config |
