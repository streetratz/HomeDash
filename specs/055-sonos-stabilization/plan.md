# Implementation Plan: Sonos Experience Stabilization

**Branch**: `055-sonos-stabilization` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Complete #227 in four independently testable slices: stabilize every Sonos
loading/empty media state, normalize and test local/cloud topology with a safe group
reset operation, make queue clearing explicit and state-complete, and extend the
existing Spotify integration with paginated saved albums, artists, and tracks.

## Technical Context

**Stack**: TypeScript, Fastify, React 18, TanStack Query, Sonos local UPnP and cloud API  
**Storage**: Existing Sonos and Spotify configuration only; no schema change expected  
**API**: Existing queue/group routes plus bounded Spotify saved-library endpoints  
**UI**: Existing compact widget, fullscreen controller, Queue panel, and Browse panel

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Security | Mutations remain admin + CSRF; Spotify tokens stay server-side; reads require authentication. |
| Input validation | Group/player IDs and Spotify cursor/limit inputs are validated at route boundaries. |
| Data integrity | Reset reports per-player results and never converts partial failure into success. |
| LAN boundary | Local Sonos calls target discovered players only; Spotify uses the existing OAuth integration. |
| Mobile/accessibility | Stable aspect ratios, labelled controls, confirmation dialogs, and 44 px touch targets are required. |
| Compatibility | Local/cloud capability differences remain explicit; existing playback and browse behavior is preserved. |
| Testing | Topology, mutation, pagination, empty-state, and confirmation paths receive focused coverage. |

**Result**: PASS.

## Design

### Stable states

Create one reusable artwork/placeholder treatment and keep surrounding media and
content geometry stable. State copy remains specific: scanning, no speakers,
no selected group, nothing playing, disconnected, or unavailable.

### Topology and reset

Normalize groups from stable player IDs before presentation. Preserve coordinators and
stereo/bonded room identity rather than reconstructing membership from only the visible
player list. Add a local-mode reset operation that attempts each removable member,
collects failures, refreshes topology, and returns a multi-result response.

### Queue

Retain the existing local queue-clear endpoint. Improve discoverability and require the
existing destructive confirmation primitive. On success, invalidate queue, playback,
group, and metadata queries. Cloud mode explains that queue mutation requires local
control.

### Spotify library

Extend the existing server-side Spotify client with bounded paginated reads for saved
albums, followed artists, saved tracks, and playlists. Normalize results into a compact
frontend contract and reuse existing play/add-to-queue actions only for supported
content.

## Threat Model

Player IDs, group IDs, Spotify pagination cursors, and limits are untrusted input.
Routes validate and bound them before use. Local mutations resolve targets from current
discovery rather than accepting caller-supplied network addresses. Spotify access and
refresh tokens never leave the backend. Partial group failures are returned explicitly,
without logging credentials or raw upstream responses.

## Validation Strategy

- Unit tests for topology normalization, removable-member selection, and Spotify
  response normalization/pagination.
- Integration tests for auth/CSRF, partial group-reset failures, queue invalidation
  contracts, Spotify auth expiry, and bounded pagination.
- Component tests for stable loading/empty frames, destructive confirmation, cloud
  capability messaging, library tabs, and append pagination.
- Full backend/frontend tests, build, zero-warning lint, UI review, and Docker upgrade
  gate before the PR.

## Rollback

No migration is planned. Reverting restores the previous Sonos presentation and
Spotify Browse subset without changing stored configuration.
