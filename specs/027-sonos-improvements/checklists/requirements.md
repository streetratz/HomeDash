# Requirements Checklist: Sonos Widget Improvements

**Spec**: 027-sonos-improvements  
**Issue**: #73

## Functional Requirements

| ID | Requirement | Phase | Status |
|----|-------------|-------|--------|
| FR-001 | Adaptive polling — slow when idle, fast when playing | Phase 1 | ☐ |
| FR-002 | Album art proxy via `/api/sonos/art/:hash` with LRU cache | Phase 2 | ☐ |
| FR-003 | Display active music service name + provider accent colours | Phase 3 | ☐ |
| FR-004 | Touch targets ≥44×44px on viewports < 1024px | Phase 4 | ☐ |
| FR-005 | Swipe gestures (left=next, right=prev) in fullscreen | Phase 4 | ☐ |
| FR-006 | Handle speaker topology changes without UI errors | Phase 5 | ☐ |
| FR-007 | Serve placeholder image when art fetch fails | Phase 2 | ☐ |
| FR-008 | No polling when widget not visible (tab hidden) | Phase 1 | ☐ |
| FR-009 | Distinguish multiple accounts of same service (multi-Spotify `sn=` detection) | Phase 3 | ☐ |
| FR-010 | UPnP event subscriptions in local mode with polling fallback | Phase 7 | ☐ |
| FR-011 | Client-side track position timer (no server polling for position) | Phase 1 | ☐ |

## Success Criteria

| ID | Criterion | Verified |
|----|-----------|----------|
| SC-001 | Idle polling rate drops ≥60% vs current 5s constant | ☐ |
| SC-002 | Album art external requests reduced ≥90% through cache | ☐ |
| SC-003 | Provider badge correct for Spotify, YT Music, Apple, TuneIn, Tidal | ☐ |
| SC-004 | Touch targets pass WCAG 2.5.5 on mobile viewports | ☐ |
| SC-005 | Widget recovers from topology changes within 15s | ☐ |
| SC-006 | Multiple Spotify accounts display distinct user-assigned labels | ☐ |
| SC-007 | Local mode UPnP events reflect state changes in UI within 1s | ☐ |
| SC-008 | Track position updates every second without server calls | ☐ |

## Non-Functional

| Concern | Requirement | Status |
|---------|-------------|--------|
| Memory | Art cache ≤ 50 entries (~25MB max) | ☐ |
| Performance | No UI jank from swipe gesture detection | ☐ |
| Compatibility | Works in both cloud and local Sonos modes | ☐ |
| Compatibility | UPnP events degrade gracefully to polling when unavailable | ☐ |
| Accessibility | No hover-only interactions | ☐ |
