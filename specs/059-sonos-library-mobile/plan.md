# Implementation Plan: Sonos Library and Mobile Fullscreen Fixes

**Branch**: `059-sonos-library-mobile` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Make local Sonos ContentDirectory reads resilient across discovered speakers, preserve
the difference between a genuine empty library and an upstream failure, normalize
folder ObjectIDs consistently, simplify only the phone fullscreen composition, and
apply one deterministic playback-aware group-selection policy across Sonos surfaces.

## Technical Context

**Language/Version**: TypeScript, Node.js 24
**Primary Dependencies**: Fastify 5, node-sonos, React 18, TanStack Query 5, Tailwind CSS
**Storage**: N/A
**Testing**: Vitest, Testing Library, Playwright, Docker upgrade gate
**Target Platform**: LAN-hosted Docker; phones from 360 px through desktop browsers
**Project Type**: Full-stack web application
**Performance Goals**: No additional polling; bounded sequential fallback across the
small discovered-speaker set
**Constraints**: No raw UPnP details in API responses; no desktop regression; no new
runtime dependency
**Scale/Scope**: One local Sonos household with a small bounded speaker set

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Security | Existing authenticated Sonos routes remain authoritative; upstream details and device addresses stay server-side. |
| Input validation | Existing library type and object-ID boundaries remain in place; no new request fields. |
| LAN boundary | All Sonos traffic remains local UPnP traffic to discovered speakers. |
| Resilience | ContentDirectory reads use bounded fallback and explicit upstream failure instead of success-shaped empty data. |
| Mobile/accessibility | Phone navigation uses 44 px targets, visible focus states, horizontal overflow containment, and no hover-only primary actions. |
| Performance | No new polling or animation library; fallback stops after the first valid response. |
| Testing | Unit/component tests cover fallback, error/empty distinction, CIFS normalization, mobile height ownership, and group-selection priority. |

**Result**: PASS. No constitution exceptions are required.

## Design

### Resilient ContentDirectory reads

Introduce a small internal helper that tries each currently discovered device for a
read-only Sonos operation. It logs one sanitized warning per failed candidate and
returns the first valid response. If all candidates fail, it throws a dedicated local
Sonos upstream error. An empty successful response remains valid and is not retried.

Candidates are ordered by capability/stability preference: soundbars first, other
fixed speakers second, and portable Roam/Move models last. The order remains stable
within each class and every speaker remains an eligible fallback.

Apply the helper to library container browsing and favorites, the two failing
ContentDirectory surfaces present in the supplied trace. The API adapter maps the
dedicated error to a safe 502 response.

### ObjectID normalization

Centralize conversion of:

- `x-rincon-playlist:...#A:...` to its fragment ObjectID;
- `x-file-cifs://host/path` to `S://host/path`;
- existing `S:` ObjectIDs unchanged.

Use the same helper for drill-down and folder queue actions so browsing and playback
cannot drift.

### Mobile fullscreen composition

Keep the desktop (`sm` and wider) two-column presentation. On phones:

- reduce header chrome and demote Party Mode to a quiet icon action;
- keep one compact now-playing card with stable transport controls;
- place Rooms, Queue, Browse, and Favorites in one non-wrapping, horizontally stable
  navigation row;
- make service and provider sub-navigation horizontally scrollable rather than
  wrapping;
- let the selected content own the remaining viewport;
- preserve safe-area padding and 44 px touch targets.

No decorative animation is added. Existing press feedback remains short and
transform-only.

### Playback-aware group selection

Use a small pure selector in each runtime boundary to rank groups without mutating the
topology response: playing and buffering first, paused second, idle or stopped third,
and unavailable or unknown last. Preserve source order within a rank. A configured
default room may win only within the same rank; a valid room selected during the
current user session remains authoritative until it disappears.

The authenticated widget, fullscreen controller, and screensaver import the same
frontend selector. Public widget projection applies the equivalent backend selector
before fetching playback, metadata, and volume.

## Source Impact

```text
backend/
├── src/services/sonosGroupSelection.ts
├── src/services/publicWidgetProjection.ts
├── src/api/sonos.ts
├── src/lib/errors.ts
├── src/services/sonos-local-service.ts
└── tests/unit/

frontend/
├── src/lib/sonosGroupSelection.ts
├── src/components/ScreensaverOverlay.tsx
├── src/components/widgets/SonosWidget.tsx
├── src/components/sonos/BrowsePanel.tsx
├── src/components/sonos/FullScreenSonos.tsx
├── src/components/sonos/__tests__/
└── tests/e2e/
```

## Validation Strategy

- Focused backend tests for failing-first fallback, all-failed behavior, valid empty
  responses, and CIFS normalization.
- Focused frontend tests for error/retry rendering and ObjectID requests.
- Responsive browser checks at 360, 390, 412, and 430 px plus a desktop regression
  viewport.
- Focused selector tests for mixed playing, buffering, paused, idle, unavailable, and
  configured-default states.
- Backend/frontend typecheck and targeted test suites.
- Candidate Docker build and local health/readiness verification for user review.
- Mandatory code, UI, upgrade, and lint gates immediately before opening the PR.

## Rollback

Revert the helpers, error mapping, selection wiring, and phone-only layout
classes/components. No database or stored configuration changes are involved.
