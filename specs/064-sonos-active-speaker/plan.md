# Implementation Plan: Sonos Active Speaker Selection

**Branch**: `064-sonos-active-speaker` | **Date**: 2026-09-24 | **Issue**: #9

## Summary

Extract one deterministic Sonos group-selection helper and reuse it in the
widget and screensaver.

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Security | No endpoint, credential, or authorization changes. |
| Mobile/accessibility | Selection changes content only; controls and layout remain unchanged. |
| Resilience | Unavailable and empty groups are excluded from automatic fallback. |
| Performance | Sorting is bounded by the small discovered-room list and adds no polling. |
| Testing | Focused unit tests cover every required priority and fallback state. |

**Result**: PASS.

## Source Impact

- `frontend/src/components/sonos/selectPreferredSonosGroup.ts`
- `frontend/src/components/widgets/SonosWidget.tsx`
- `frontend/src/components/ScreensaverOverlay.tsx`
- focused Sonos unit tests
