# Quickstart — Performance Optimizations & Pi-hole Widget Polish

**Feature Branch**: `040-perf-and-polish`  
**Date**: 2026-06-22

## Prerequisites

- Node.js ≥ 22.13.0
- pnpm ≥ 11.0.0
- Modern browser with DevTools (for verifying bundle/network behaviour)

## Development Setup

```bash
# Clone and switch to feature branch
git checkout 040-perf-and-polish

# Install dependencies
pnpm install

# Start development servers (frontend + backend in parallel)
pnpm dev
```

Frontend runs at `http://localhost:5173` with HMR.  
Backend API at `http://localhost:3000` (proxied via Vite).

## Key Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start all dev servers |
| `pnpm --filter frontend run build` | Production build (verify chunk splitting) |
| `pnpm --filter frontend run test` | Run Vitest unit tests |
| `pnpm --filter frontend run test:e2e` | Run Playwright E2E tests |
| `pnpm typecheck` | TypeScript type checking (all workspaces) |
| `pnpm lint` | ESLint (all workspaces) |

## Verifying Changes

### Code Splitting

After building (`pnpm --filter frontend run build`), check `frontend/dist/assets/` for separate route chunks:
```bash
ls frontend/dist/assets/ | grep -E 'Dashboard|Settings|FirstRun|Login'
```

Expected: 4 separate JS files (one per route).

### Polling Intervals

1. Open browser DevTools → Network tab
2. Navigate to dashboard with Pi-hole or UniFi widget
3. Confirm requests occur at ~60s intervals (not 30s)
4. For Spotify: switch tab away, confirm no requests; switch back, confirm requests resume

### Pi-hole Compact Layout

1. In Settings → General, set grid cell size to 180px
2. Navigate to dashboard with Pi-hole widget
3. Confirm no horizontal overflow or clipped content
4. Reset to 300px+ and confirm standard layout unchanged

## Architecture Notes

- **No backend changes** — all work is frontend-only
- **Polling logic** lives in TanStack Query hook options (`staleTime`, `refetchInterval`)
- **Visibility detection** via new `useWidgetVisibility` hook combining Page Visibility API + IntersectionObserver
- **Code splitting** via `React.lazy()` in `frontend/src/app/router.tsx`
- **Error recovery** via a `ChunkErrorBoundary` component wrapping lazy routes
- **Compact layout** uses a `compact` prop/class variant on the existing `PiholeWidget` component

## Files to Focus On

| File | What Changes |
|------|--------------|
| `frontend/src/app/router.tsx` | Convert static imports to `React.lazy` |
| `frontend/src/state/piholeHooks.ts` | Adjust `staleTime`/`refetchInterval` defaults |
| `frontend/src/state/unifiHooks.ts` | Adjust `staleTime`/`refetchInterval` defaults |
| `frontend/src/hooks/useSpotify.ts` | Accept visibility + playback state for adaptive polling |
| `frontend/src/hooks/useWidgetVisibility.ts` | **New** — visibility detection hook |
| `frontend/src/components/widgets/PiholeWidget.tsx` | Add compact layout mode |
| `frontend/src/components/widgets/SpotifyWidget.tsx` | Integrate visibility hook |
| `frontend/src/components/ChunkErrorBoundary.tsx` | **New** — error boundary for lazy routes |
