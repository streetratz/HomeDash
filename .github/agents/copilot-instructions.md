# HomeDash Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-21

## Active Technologies
- TypeScript 5.5+ on Node.js ≥ 20 (pnpm 8+ monorepo) (002-widget-management)
- SQLite via better-sqlite3 / Drizzle ORM — no new tables; all config in `app_widget_instances.configJson` (002-widget-management)
- TypeScript 5.x (strict mode) — pnpm monorepo + Fastify 4.28, Drizzle ORM 0.45.2, better-sqlite3 11.3, Zod 3.23, React 18, Vite, TanStack Query, shadcn/ui, Tailwind CSS, react-grid-layou (011-dashboard-duplication)
- SQLite (WAL mode) via better-sqlite3 + Drizzle ORM; data at `HOMEDASH_DATA_DIR/db/homedash.sqlite` (011-dashboard-duplication)
- TypeScript 5.x (Node.js backend, React 18 frontend) + Fastify (HTTP), Drizzle ORM (DB), better-sqlite3 (SQLite), Zod (validation), React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query (012-rbac-permissions)
- SQLite via better-sqlite3 + Drizzle ORM; migrations in `backend/drizzle/` (012-rbac-permissions)
- TypeScript 5+ (Node.js backend, React 18 frontend) + Fastify + Drizzle ORM + better-sqlite3 + Zod (backend); React 18 + Vite + Tailwind + shadcn/ui + TanStack Query + react-grid-layout (frontend) (013-app-shortcuts)
- SQLite via Drizzle ORM; file uploads in `$HOMEDASH_DATA_DIR/uploads/` (013-app-shortcuts)
- TypeScript 5.x (Node.js backend, Vite/React frontend) + Fastify, Drizzle ORM, better-sqlite3, Zod (backend); React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query (frontend) (023-full-backup-restore)
- SQLite via Drizzle ORM (`backend/src/db/schema/index.ts`, 29 tables) (023-full-backup-restore)

- Node.js 20 LTS + TypeScript (backend and frontend) (001-homelab-dashboard)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

Node.js 20 LTS + TypeScript (backend and frontend): Follow standard conventions

## Recent Changes
- 023-full-backup-restore: Added TypeScript 5.x (Node.js backend, Vite/React frontend) + Fastify, Drizzle ORM, better-sqlite3, Zod (backend); React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query (frontend)
- 013-app-shortcuts: Added TypeScript 5+ (Node.js backend, React 18 frontend) + Fastify + Drizzle ORM + better-sqlite3 + Zod (backend); React 18 + Vite + Tailwind + shadcn/ui + TanStack Query + react-grid-layout (frontend)
- 012-rbac-permissions: Added TypeScript 5.x (Node.js backend, React 18 frontend) + Fastify (HTTP), Drizzle ORM (DB), better-sqlite3 (SQLite), Zod (validation), React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
