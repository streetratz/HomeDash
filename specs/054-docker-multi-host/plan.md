# Implementation Plan: Docker Multi-Host Widget

**Branch**: `054-docker-multi-host` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Allow one Docker widget to link an ordered set of saved Docker connections. The backend
will expose only linked host IDs and names, validate widget/connection ownership for
every list or action request, and preserve the existing single-link service behavior for
Pi-hole and UniFi. The frontend will use client-side fan-out and grouped host sections,
while omitting host chrome for a single connection.

## Technical Context

**Stack**: TypeScript, Fastify, Drizzle/SQLite, React 18, TanStack Query
**Migration**: Add `sort_order` to `widget_connections`; expand the unique index to
`(widget_instance_id, connection_type, connection_id)`
**API**: Ordered Docker-link replacement, authenticated host listing, connection-scoped
container listing/actions
**UI**: Ordered multi-select configuration and per-host keyed sections

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Security | All runtime routes require authentication; actions remain admin + CSRF; connection IDs are verified against the widget before endpoint resolution. |
| Input validation | Zod validates query/body IDs and ordered connection arrays; duplicate IDs are rejected. |
| Data integrity | Docker link replacement runs transactionally; generated migration preserves existing rows with `sort_order = 0`. |
| LAN boundary | No caller supplies an endpoint; only admin-persisted and widget-linked Docker connections can be dialed. |
| Resilience | Client-side independent queries prevent one slow host from blocking siblings. |
| Mobile/accessibility | Full-width grouped sections, 44 px selection/reorder controls, semantic labels, and visible focus states from 360 px. |
| Compatibility | Generic link replacement remains unchanged for Pi-hole/UniFi; single-host Docker output keeps existing chrome. |
| Backup/upgrade | Existing generic backup table coverage includes the new column; migration and upgrade gates verify preservation. |

**Result**: PASS.

## Design

### Data model

`widget_connections.sort_order INTEGER NOT NULL DEFAULT 0` records deterministic order.
The unique index adds `connection_id`, allowing multiple distinct rows of one type while
preventing duplicates.

The existing generic `linkWidgetToConnection()` deliberately keeps delete-then-insert
replacement semantics. A separate Docker-only replacement service validates all IDs,
deletes current Docker rows, and inserts the requested order in one transaction.

### Runtime API

- `GET /api/docker/hosts?widgetInstanceId=...`
  - authenticated;
  - returns ordered `{ connectionId, name }` rows;
  - never returns endpoint URLs.
- `GET /api/docker/containers?widgetInstanceId=...&connectionId=...`
  - authenticated;
  - validates that the connection is linked to the widget;
  - requires an explicit `connectionId`, including for widgets with one link.
- `POST /api/docker/action`
  - admin + CSRF;
  - adds `connectionId`;
  - validates the same widget/connection relationship.
- `PUT /api/admin/connections/docker-links`
  - admin + CSRF;
  - atomically replaces ordered Docker links.

### Frontend

The Docker config form gets a dedicated ordered connection selector rather than
changing the generic single-link picker. The widget first loads host metadata, then
renders one keyed host section per connection. Each section owns its own container query
and action mutation.

For one host, the section renders the current summary/list/error presentation without a
host header. For multiple hosts, each section receives a sticky, full-width host header
and inline state.

## Threat Model

Connection IDs are untrusted identifiers. A caller must not be able to supply another
widget's connection ID to turn an authenticated Docker route into an endpoint selector.
Every list and action path therefore verifies the `(widget_instance_id,
connection_type='docker', connection_id)` row before reading `docker_url` or opening a
transport. Host-list responses expose names and opaque IDs only. Endpoint CRUD and link
replacement remain admin-only; mutations remain CSRF-protected.

## Validation Strategy

- Migration generation and migration-content review.
- Backend integration tests for ordered links, generic replace semantics, host listing,
  cross-widget rejection, independent endpoint selection, actions, and backup/restore.
- Frontend hook tests for connection-scoped request/query keys.
- Component tests for one-host no-chrome behavior, multiple grouped hosts, and isolated
  host errors.
- Backend/frontend typecheck and focused test suites during implementation.
- Mandatory final code/UI review, full lint, build, unit suites, and Docker upgrade gate.

## Rollback

Revert the feature code and migration before release. The migration is additive except
for index replacement; existing rows remain valid because every legacy row receives
`sort_order = 0`.
