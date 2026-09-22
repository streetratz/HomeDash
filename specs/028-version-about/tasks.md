# Tasks: Version, Build Details & About Tab

## Phase 1 — Build-time + Backend

### T001 — Vite build-time injection
- **File**: `frontend/vite.config.ts`
- **What**: Add `define` block injecting `__APP_VERSION__`, `__BUILD_DATE__`, `__GIT_COMMIT__`, `__GIT_REPO__`
- **Also**: Create `frontend/src/env.d.ts` (or update existing) with global type declarations
- **Status**: Pending

### T002 — Frontend build info module
- **File**: `frontend/src/lib/buildInfo.ts`
- **What**: Export typed constants: `APP_VERSION`, `BUILD_DATE`, `GIT_COMMIT`, `GIT_REPO`, `COMMIT_URL`
- **Status**: Pending

### T003 — Backend system info endpoint
- **File**: `backend/src/api/system.ts`
- **What**: `GET /api/system/info` returning version, nodeVersion, environment, uptime, uptimeHuman
- **Register**: in `backend/src/api/index.ts`
- **No auth required** — read-only, non-sensitive
- **Status**: Pending

## Phase 2 — About Tab UI

### T004 — AboutTab component
- **File**: `frontend/src/components/settings/AboutTab.tsx`
- **What**: Build info section (version, date, commit link, env) + server info section (uptime, node version)
- **Hook**: `useSystemInfo()` — fetches `/api/system/info`, staleTime 60s
- **Status**: Pending

### T005 — Register About tab in Settings
- **File**: `frontend/src/pages/SettingsPage.tsx`
- **What**: Add "About" tab (Info icon), visible to ALL users (not admin-gated), positioned last
- **Status**: Pending

## Phase 3 — Changelog

### T006 — CHANGELOG.md + build-time injection
- **File**: `CHANGELOG.md` (repo root), `frontend/vite.config.ts`
- **What**: Create CHANGELOG.md in Keep a Changelog format. Extend Vite `define` to read it via `fs.readFileSync` and inject as `__CHANGELOG__` string
- **Also**: Add type declaration for `__CHANGELOG__` in env.d.ts
- **Status**: Pending

### T007 — Changelog section in AboutTab
- **File**: `frontend/src/components/settings/AboutTab.tsx`
- **What**: Render `__CHANGELOG__` markdown inline with a lightweight renderer
- **Link**: "View full changelog on GitHub" at bottom
- **Markdown**: Check if a renderer exists in deps, else add one (e.g. `react-markdown` or `marked`)
- **Status**: Pending

## Phase 4 — Validation

### T008 — Typecheck, lint, test, verify
- **What**: `pnpm typecheck`, `pnpm lint`, `pnpm test`, manual verification
- **Also**: Test with `pnpm build` to verify define injection works in production mode
- **Status**: Pending
