# Quickstart: Settings & Config Fixes

**Feature**: 039-settings-config-fixes  
**Date**: 2026-06-22

## Overview

This feature fixes seven disconnected settings that save but never apply. No new endpoints, migrations, or environment variables are introduced. All changes modify existing files.

## Prerequisites

- Node.js 20+
- pnpm 8+
- Project dependencies installed (`pnpm install` at repo root)

## Development Workflow

```bash
# Start dev servers (from repo root)
pnpm --filter backend dev     # Fastify on :3001
pnpm --filter frontend dev    # Vite on :5173

# Run tests
pnpm --filter backend test    # Vitest (backend)
pnpm --filter frontend test   # Vitest (frontend unit)
```

## Files to Modify

### Backend (3 files)

| File | Change | Story |
|------|--------|-------|
| `backend/src/api/public.ts` | Add `titleFont`, `titleFontSizePx`, `clockDisplayConfig` to shellPayload; remove `headerStyleTarget` | US1, US4, US5 |
| `backend/tests/unit/shellSettingsService.test.ts` | New file: unit tests for `isValidTimezone` | US6 |

### Frontend (4 files)

| File | Change | Story |
|------|--------|-------|
| `frontend/src/state/bootstrap.ts` | Add `titleFont`, `titleFontSizePx`, `clockDisplayConfig` to `ShellSettings` type; remove `headerStyleTarget` | US1, US4, US5 |
| `frontend/src/components/ShellLayout.tsx` | Apply font styles to title span; render repoUrl link in footer | US1, US3 |
| `frontend/src/components/ClockStrip.tsx` | Accept `clockDisplayConfig` prop; use instead of deriving from home clock | US4 |
| `frontend/src/components/settings/AppearanceTab.tsx` | Add `['public-bootstrap']` invalidation after logo upload; replace screensaver inline mutation with `useUpdateShellSettings()` | US2, US7 |

## Verification Checklist

1. **Font applies**: Save font settings in admin → public dashboard title renders with chosen font/size
2. **Logo updates**: Upload logo → header logo updates without page refresh
3. **Repo link visible**: Set repoUrl → footer shows clickable "Repository" link
4. **Clock config works without home clock**: Set display config, remove home timezone → extra clocks still use the configured layout
5. **headerStyleTarget gone**: Check bootstrap response — field absent
6. **UTC validates**: Run backend tests — `isValidTimezone('UTC')` passes
7. **Screensaver cache correct**: Save screensaver settings → admin panel reflects change immediately

## No Configuration Changes

- No new environment variables
- No database migrations
- No Docker/deployment changes
- No new dependencies
