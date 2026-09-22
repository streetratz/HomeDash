# Quickstart — Sonos Widget Bug Fixes

**Branch**: `041-sonos-bug-fixes` | **Date**: 2026-06-22

## Overview

Three targeted bug fixes to the existing Sonos widget:

1. **Stereo pair phantom rooms** — Filter invisible zone group members from the groups API response
2. **Volume slider targets all members** — Send volume commands to coordinator only
3. **Now-playing marquee** — Animate only when text overflows; pause when not playing; add to fullscreen view

## Prerequisites

- Node.js 20+
- pnpm 9+
- Sonos speakers on the LAN (for integration testing)

## Development Setup

```bash
# Clone and checkout feature branch
git checkout 041-sonos-bug-fixes

# Install dependencies
pnpm install

# Run development servers (backend + frontend)
pnpm dev
```

## Files to Modify

### Bug 1: Stereo Pair Filtering

| File | Change |
|------|--------|
| `backend/src/services/sonos-local-service.ts` | Filter `Invisible` members in `getGroups()` and `zoneGroupToGroup()` |
| `backend/tests/unit/sonosDiscovery.test.ts` | Add test cases for stereo pair filtering |

### Bug 2: Volume Coordinator Only

| File | Change |
|------|--------|
| `backend/src/services/sonos-local-service.ts` | Change `setGroupVolume()` to use `getCoordinatorForGroup()` instead of `getMembersForGroup()` |
| `backend/tests/unit/` | Add unit test for volume targeting coordinator |

### Bug 3: Conditional Marquee

| File | Change |
|------|--------|
| `frontend/src/hooks/useTextOverflow.ts` | New hook: ResizeObserver-based overflow detection |
| `frontend/src/components/widgets/SonosWidget.tsx` | Conditional marquee based on overflow + playback state |
| `frontend/src/components/sonos/FullScreenSonos.tsx` | Add marquee animation to track title |
| `frontend/src/` (test) | Unit test for useTextOverflow hook |

## Testing

```bash
# Run all tests
pnpm test

# Backend unit tests only
pnpm --filter backend test:unit

# Frontend unit tests only
pnpm --filter frontend test:unit

# Frontend E2E (requires dev server running)
pnpm --filter frontend test:e2e

# Type checking
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
```

## Verification Checklist

- [ ] Stereo-paired speakers show as single room (not two)
- [ ] Splitting a stereo pair shows both speakers independently
- [ ] Group volume slider changes coordinator volume only
- [ ] Per-player volume sliders still work in fullscreen
- [ ] Short track titles display statically (no animation)
- [ ] Long track titles scroll with marquee animation
- [ ] Track change resets animation cleanly
- [ ] Pausing playback stops marquee animation
- [ ] Fullscreen view animates long titles same as widget
- [ ] All existing Sonos tests pass (no regressions)
