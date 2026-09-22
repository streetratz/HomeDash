# HomeDash Quickstart (planned)

**Date**: 2026-02-21  
**Spec**: `specs/001-homelab-dashboard/spec.md`

This quickstart matches the planned project structure in `plan.md`. It will be updated once the repository is scaffolded.

## Prerequisites

- Node.js 20 LTS
- A package manager (choose one for the repo; recommended: `pnpm` for workspace support)

## Environment variables

Minimal set (planned):

- `HOMEDASH_HOST` (default: `0.0.0.0`)
- `HOMEDASH_PORT` (default: `3000`)
- `HOMEDASH_DATA_DIR` (default: `./data`)
- `HOMEDASH_SESSION_SECRET` (required in production; mount via secrets)

Security / deployment:

- `HOMEDASH_ALLOWED_ORIGINS` (optional; comma-separated allowlist; empty = same-origin only)
- `HOMEDASH_TRUST_PROXY` (optional; set when behind reverse proxy)
- `HOMEDASH_LOG_LEVEL` (default: `info`)

## Planned local development

From repo root:

- Install deps: `pnpm install`
- Run backend (dev): `pnpm -C backend dev`
- Run frontend (dev): `pnpm -C frontend dev`

Expected:

- Frontend dev server on a local port (Vite)
- Backend API server on `http://localhost:3000`

## Planned production build

- Build frontend: `pnpm -C frontend build`
- Build backend: `pnpm -C backend build`
- Run server: `pnpm -C backend start`

## Data directory

`HOMEDASH_DATA_DIR` contains:

- `db/homedash.sqlite`
- `uploads/` (logo, backgrounds)
- `icon-cache/` (cached icons)

Backups: bind-mount this directory and back it up as a unit.

## Health endpoints

- `GET /healthz`: liveness
- `GET /readyz`: readiness (DB reachable + migrations applied)

## First run

- Navigate to `/` on a fresh install.
- If no users exist, the UI will prompt to create the initial admin user.

## Notes for Synology / Docker host networking

- Bind host/port explicitly via env vars.
- If running behind a reverse proxy with TLS termination, ensure cookies are configured for `Secure`.
- Keep CORS disabled unless you have a clear cross-origin requirement.
