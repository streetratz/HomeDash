# Phase 0 Research: Homelab Dashboard (HomeDash)

**Date**: 2026-02-21  
**Spec**: `specs/001-homelab-dashboard/spec.md`

This document resolves the technical unknowns in `plan.md` and records choices with rationale and alternatives.

---

## Decision: Backend runtime + framework

- **Decision**: Node.js 20 LTS + TypeScript + Fastify.
- **Rationale**:
  - Great fit for a LAN-hosted web app: single binary-ish runtime, easy Docker deployment, fast request handling.
  - Mature ecosystem for cookie sessions, CSRF protection, security headers, and structured logging.
  - Pairs cleanly with a React SPA served from the same origin (simplifies CORS and cookie auth).
- **Alternatives considered**:
  - FastAPI (Python): strong typing with Pydantic, but adds Python env management and two-language stack if frontend is React.
  - ASP.NET Core: very solid auth + hosting story, but heavier setup for a small NAS app if the team is not already .NET-first.

## Decision: Frontend stack

- **Decision**: React + Vite + TypeScript + Tailwind CSS.
- **Rationale**:
  - React ecosystem has proven grid-layout editing libraries and patterns.
  - Vite keeps dev iteration fast and bundles are small for low-power devices.
  - Tailwind keeps styling consistent while supporting mobile-first responsiveness.
- **Alternatives considered**:
  - Next.js: great SSR, but adds complexity not required for a dashboard that can be a SPA served by the backend.
  - SvelteKit: excellent performance, but smaller ecosystem for drag/drop/resize dashboard editing.

## Decision: Authn/authz model (cookie sessions)

- **Decision**: Cookie-based session ID (HttpOnly) + server-side sessions stored in SQLite. Role-based authz with explicit `admin` checks.
- **Rationale**:
  - Works well for LAN and reverse-proxy deployments.
  - Keeps secrets out of browser storage and supports session invalidation.
  - SQLite-backed sessions avoid cache dependencies and remain offline-capable.
- **Alternatives considered**:
  - JWT access tokens: increased XSS blast radius and token revocation complexity.
  - Stateless encrypted cookies only: workable, but harder to revoke/rotate at scale and can bloat cookies.

## Decision: CSRF protection

- **Decision**: Enforce CSRF for all state-changing requests (POST/PUT/PATCH/DELETE) when using cookie sessions.
  - Use `X-CSRF-Token` header with a per-session token (or synchronizer token) plus `SameSite=Lax`.
- **Rationale**: Constitution requires CSRF on cookie-based auth; it prevents cross-site request forgery on admin actions.
- **Alternatives considered**:
  - Relying solely on `SameSite`: not sufficient as a hard guarantee.

## Decision: Password hashing

- **Decision**: Argon2id hashing with per-password salt; fallback to bcrypt only if deployment constraints require.
- **Rationale**: Constitution requires modern password hashing and prohibits reversible storage.
- **Alternatives considered**:
  - PBKDF2: acceptable, but Argon2id is preferred when available.

## Decision: SQLite access + migrations

- **Decision**: Drizzle ORM + `better-sqlite3` (synchronous driver) with versioned migrations.
- **Rationale**:
  - SQLite is required by spec.
  - Drizzle keeps schema typed and migrations explicit.
  - A startup migration step aligns with container readiness checks.
- **Alternatives considered**:
  - Prisma: good DX but heavier runtime and migration expectations.
  - Raw SQL: simplest, but more error-prone and less typed.

## Decision: Data directory layout (uploads + cache)

- **Decision**: Single configurable `HOMEDASH_DATA_DIR` containing:
  - `db/homedash.sqlite`
  - `uploads/` (logo + background images)
  - `icon-cache/` (downloaded/cached icons)
  - `logs/` (optional file logs; stdout remains primary)
- **Rationale**: NAS deployments prefer one bind-mounted directory; simplifies backup/restore.
- **Alternatives considered**:
  - Store blobs in SQLite: increases DB size and backup overhead.

## Decision: Image upload validation

- **Decision**: Validate uploads by:
  - maximum byte size,
  - content-type allowlist,
  - magic-byte sniffing (do not trust `Content-Type`),
  - atomic write (temp file + rename),
  - store metadata (sha256, size, mime, original filename) in DB.
- **Rationale**: Prevents malformed/unsafe uploads and supports troubleshooting.

## Decision: Device context detection (web vs mobile dashboards)

- **Decision**: Determine device context via server-side user-agent parsing (not viewport width).
  - Provide safe fallback: default to `web` for unknown UAs.
- **Rationale**: Matches FR-004a and avoids client-side spoofing affecting authorization.
- **Alternatives considered**:
  - Viewport-width based: explicitly rejected by spec.

## Decision: Grid editing library

- **Decision**: `react-grid-layout` for drag/drop/resize grid editing.
- **Rationale**:
  - Widely used for dashboards, supports responsive layouts and resizing.
  - Fits the placeholder model (stable IDs, x/y/w/h persisted).
- **Accessibility plan**:
  - Provide keyboard-accessible controls for move/resize (incremental nudge + resize handles) and ARIA live announcements during edits.
- **Alternatives considered**:
  - Gridstack.js: capable, but heavier integration and different React patterns.
  - Pure HTML/CSS grid with custom drag logic: highest effort.

## Decision: Icons (selfh.st) fetch + cache

- **Decision**:
  - Best-effort, admin-controlled refresh action that downloads/updates icon metadata and icon assets into the local cache.
  - Runtime icon resolution uses cached assets only; if missing/unavailable, render a safe built-in fallback.
  - Automatic selection uses normalized hostname mapping; manual overrides stored per-link.
- **Rationale**: Matches offline-first requirement and avoids unsolicited external callbacks.
- **Alternatives considered**:
  - Fetch on every page load: rejected (offline/telemetry concerns).

## Decision: Security headers + CORS

- **Decision**:
  - Use Helmet to set CSP and baseline headers.
  - Keep everything same-origin by default; only enable CORS if a real cross-origin deployment needs it; CORS allowlist must be explicit and configurable.
- **Rationale**: Constitution requires explicit cross-origin controls.

## Decision: Operability (health + logging)

- **Decision**:
  - `/healthz`: process is up.
  - `/readyz`: DB reachable + migrations applied.
  - Structured logs (Pino) with request IDs and redaction of secrets.
- **Rationale**: NAS/container environments need diagnosable behavior.

## Decision: Testing strategy

- **Decision**:
  - Backend: Vitest unit + integration tests including authn/authz and first-run constraints.
  - Frontend: component tests for header controls and Links widget rendering.
  - E2E: Playwright smoke for first-run -> dashboard, unauth view, admin edit.
  - Contract: OpenAPI checked in and validated in CI.
- **Rationale**: Constitution makes auth + change safety non-negotiable.
