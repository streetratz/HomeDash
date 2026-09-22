# Implementation Plan: Pi-hole DNS Controls Widget

**Branch**: `014-pihole-widget` | **Date**: 2025-07-15 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/014-pihole-widget/spec.md`

## Summary

Add a Pi-hole widget type that proxies Pi-hole v6 REST API calls through the HomeDash backend, displaying DNS stats (total queries, blocked queries, percentage, clients, blocklist domains), system health (CPU, memory, load), and providing enable/disable blocking controls with timer options (5m, 15m, 30m, indefinitely). The API token is stored encrypted server-side using the existing `token-encryption.ts` module. The frontend polls for stats at a configurable interval (default 30s).

## Technical Context

**Language/Version**: TypeScript (Node 20+)  
**Primary Dependencies**: Fastify (backend), React 18 + TanStack Query (frontend), Zod (validation)  
**Storage**: SQLite via Drizzle ORM — new `pihole_instances` table for connection config  
**Testing**: Vitest (unit/integration), Playwright (E2E)  
**Target Platform**: LAN-hosted Docker on Synology NAS  
**Project Type**: Web (pnpm monorepo: `backend/` + `frontend/`)  
**Performance Goals**: Stats refresh within 30s default poll; widget renders in <1s  
**Constraints**: LAN-only, no internet required; Pi-hole v6+ only  
**Scale/Scope**: Single Pi-hole instance per widget; multiple widgets allowed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Secure-by-default**: API token stored encrypted via AES-256-GCM (`token-encryption.ts`). All Pi-hole API calls proxied through authenticated backend routes. Token never sent to frontend. CSRF required for mutations (enable/disable blocking).
- [x] **LAN-only boundary**: Widget connects to Pi-hole via LAN IP/hostname from backend only. No external callbacks. CORS already configured for LAN.
- [x] **Mobile-first UI**: Stats card layout responsive. Blocking toggle touch-friendly (≥44×44px). Tested on mobile viewport.
- [x] **Operability**: Failed Pi-hole API calls logged with endpoint + HTTP status (token redacted). Widget shows error states with guidance.
- [x] **Testing & change safety**: Backend service + API routes get unit/integration tests. Token encryption tested. Widget config validation tested. Migration tested.

## Project Structure

### Documentation (this feature)

```text
specs/014-pihole-widget/
├── spec.md              # Feature specification
├── changelog-spec.md    # Spec changelog
├── plan.md              # This file
├── research.md          # Pi-hole v6 API reference
├── data-model.md        # Database schema
├── contracts/           # API endpoint contracts
│   └── pihole-proxy.md  # HomeDash ↔ Pi-hole proxy routes
├── tasks.md             # Task breakdown
├── checklists/
│   └── requirements.md  # Requirements checklist
└── logs/                # Implementation logs (created at build time)
    └── readme.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   └── schema/index.ts          # + pihole_instances table
│   ├── services/
│   │   └── pihole-service.ts        # Pi-hole API client (fetch, decrypt token, proxy)
│   ├── api/
│   │   └── pihole.ts                # Fastify routes: config CRUD, stats, blocking control
│   └── lib/
│       └── validation.ts            # + PiholeConfigSchema
└── tests/
    ├── unit/
    │   └── pihole-service.test.ts
    └── integration/
        └── pihole-api.test.ts

frontend/
├── src/
│   ├── components/widgets/
│   │   ├── PiholeWidget.tsx          # Display component (stats, blocking toggle)
│   │   └── PiholeConfigForm.tsx      # Config form (URL, token, poll interval)
│   ├── state/
│   │   └── piholeHooks.ts           # TanStack Query hooks (stats, blocking)
│   └── components/widgets/registry.tsx  # + pihole registration
└── tests/
    └── components/
        └── PiholeWidget.test.tsx
```

**Structure Decision**: Follows existing HomeDash monorepo pattern. Similar to Spotify widget pattern (backend service proxies external API, frontend hooks + widget component).

## Complexity Tracking

No constitution violations. All requirements align with existing patterns:
- Token encryption: reuses `token-encryption.ts`
- Backend proxy: follows Spotify/weather proxy pattern
- Widget registration: follows established widget system
- Auth guards: reuses `requireAdmin` + `assertCsrf`
