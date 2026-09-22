# Implementation Plan: Sonos Service Discovery and Browse

**Branch**: `048-sonos-service-discovery` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/048-sonos-service-discovery/spec.md`

## Summary

Complete #82, #83, and #84 by adding a safe Sonos service/account discovery model,
rewiring Browse around real provider/account availability, and finishing the existing
speaker-detail presentation. Local discovery combines the MusicServices catalog,
firmware account metadata when available, Sonos Favorites, and active playback
references. Cloud mode degrades to provider names inferred from Control API favorites.

## Technical Context

**Language/Version**: TypeScript, Node 22, React 18
**Primary Dependencies**: Fastify 4, `sonos` 1.14.3, TanStack Query 5, Vite 5
**Storage**: Existing `integration_configs` account-label JSON only; no schema change
**Testing**: Vitest, Fastify integration tests, Playwright
**Target Platform**: Host-networked Docker container on a private LAN
**Project Type**: Fastify backend plus React frontend
**Performance Goals**: One bounded discovery pass per cache window; no new polling loop
**Constraints**: Hostile LAN, firmware-dependent account endpoint, no credential
exposure, no native third-party SMAPI authentication
**Scale/Scope**: One Sonos household with tens of speakers, services, favorites, and
account references

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Secure by default | New endpoint is authenticated and read-only; admin-only label mutations retain CSRF. |
| Input validation | Query parameters are bounded with Zod; Sonos XML is size-bounded and parsed into an allowlisted safe shape. |
| Secret handling | Usernames, keys, tokens, OAuth device IDs, and raw XML are discarded before logging or response construction. |
| LAN boundary | Requests target only already-discovered Sonos devices on port 1400; no user-supplied URL is accepted. |
| Mobile/accessibility | Selector and account controls use labelled native buttons/selects with touch-sized targets. |
| Operational readiness | Partial source failures are represented through source/completeness metadata and structured warnings. |
| Testing/change safety | Parser, aggregation, route auth, browse logic, and UI rendering receive automated coverage. |
| Data migration | Not applicable; existing account-label storage remains unchanged. |

**Result**: PASS.

## Project Structure

```text
backend/
├── src/services/sonos-local-service.ts   # catalog/account/favorite aggregation
├── src/services/sonos-adapter.ts         # local/cloud service discovery contract
├── src/api/sonos.ts                      # authenticated services route
├── src/types/sonos.d.ts                  # MusicServices subset
└── tests/unit/                            # parser and aggregation coverage

frontend/
├── src/hooks/useSonos.ts                  # service/account types and query hook
├── src/components/sonos/BrowsePanel.tsx  # dynamic selector and favorites surface
├── src/components/settings/IntegrationsTab.tsx
└── tests/unit/browseServices.test.ts

specs/048-sonos-service-discovery/
├── spec.md
├── plan.md
├── tasks.md
├── changelog-spec.md
└── logs/
```

**Structure Decision**: Extend the existing Sonos adapter and UI surfaces. Do not add a
parallel integration layer or persistent service table because discovery data is
firmware-owned and short-lived.

## Design Decisions

| Decision | Rationale |
| --- | --- |
| Aggregate multiple discovery sources | No single Sonos interface reliably exposes every linked account on all firmware. |
| Mark source and completeness | Prevents inferred favorites from being presented as authoritative household inventory. |
| Retain `sn:<number>` labels | Preserves existing configuration and now-playing badge behavior. |
| Use favorites for non-native providers | Delivers useful browse/play behavior without extracting credentials or implementing undocumented SMAPI auth. |
| Treat services as household-wide | Sonos replicates account configuration across players; duplicating per-speaker data would be misleading. |
| Cache discovery briefly | Service catalogs are stable, while favorite and playback references can change. |

## Threat Model

The backend reads XML and metadata from LAN speakers, which are not trusted merely
because they are local. Responses are bounded, parsed into allowlisted fields, and never
logged raw. Account usernames and credential-bearing fields are discarded. The new API
requires an authenticated session and exposes only provider names, opaque account serials,
safe nicknames, user labels, capabilities, and discovery provenance. No user-controlled
host or outbound URL is accepted.

## Rollback

The change introduces no schema or migration. Reverting restores the hardcoded Browse
selector and prior speaker presentation; existing account-label JSON remains valid.
