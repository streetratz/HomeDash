# Implementation Plan: Version, Build Details & About Tab

## Approach

Small, focused feature. Three layers:
1. **Build-time injection** — Vite `define` config injects version/commit/date as globals
2. **Backend endpoint** — Lightweight `/api/system/info` for runtime data (uptime, node version)
3. **Frontend About tab** — New tab in Settings showing all info + inline changelog from GitHub Releases API

## Phases

### Phase 1: Build-time + Backend (T001–T003)
- Modify `vite.config.ts` to inject `__APP_VERSION__`, `__BUILD_DATE__`, `__GIT_COMMIT__`, `__GIT_REPO__`
- Add global type declarations for the injected constants
- Create `GET /api/system/info` endpoint (no auth required)

### Phase 2: About Tab UI (T004–T005)
- Create `AboutTab.tsx` component with build info + server info sections
- Register tab in `SettingsPage.tsx` (visible to all users, not admin-gated)

### Phase 3: Changelog (T006–T007)
- Create `useGitHubReleases` hook fetching from GitHub API
- Render changelog section with markdown release notes
- "View all releases" link

### Phase 4: Validation (T008)
- Typecheck, lint, test
- Manual verification in dev + simulated production build
