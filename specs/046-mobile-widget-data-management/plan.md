# Implementation Plan: Mobile Widget Data Management

**Branch**: `046-mobile-widget-data-management` | **Date**: 2026-09-19  
**Spec**: [spec.md](./spec.md)

## Summary

Deliver #214, #215, the static-ICS phase of #180, and portable restore fixes #216/#217
as one cohesive mobile
hardening pass:

1. Introduce shared `widget-panel` and `widget-panel-header` surfaces and contain
   mobile placeholder painting.
2. Replace the Stocks ticker chips with expandable holding editors that manage lots.
3. Add `ical_file` persistence, shared body parsing, authenticated import routes, and
   an upload/re-upload UI.
4. Make portable backups round-trip into a fresh installation while preserving only
   the authenticated bootstrap administrator's credentials.

## Technical Context

- React 18, Tailwind CSS, shadcn/Radix, TanStack Query
- Fastify, Zod, Drizzle ORM, SQLite, node-ical
- No new dependencies
- One generated SQLite migration adds nullable ICS content and filename columns

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Secure by default | Import routes use `requireAdmin`, CSRF, ownership checks, bounded validated content, and do not expose stored ICS bodies. |
| Mobile-first | Controls reflow vertically at narrow widths and use existing accessible primitives. |
| LAN boundary | Static import adds no outbound request; existing URL validation remains unchanged. |
| Operational readiness | Import/sync errors use existing API error handling and source sync status. |
| Testing and change safety | Parser, route authorization, re-import, Stocks editing, and mobile surfaces receive targeted coverage and logged command output. |
| Data migration | Schema is changed through Drizzle generation; existing rows receive nullable columns. |
| Disaster recovery | Portable restore is atomic, credential-free at rest, and ordered by database dependencies. |

**Result**: PASS.

## Design Decisions

| Decision | Rationale |
| --- | --- |
| Shared semantic panel classes | Prevents each widget from independently choosing opaque black surfaces. |
| Lots remain in widget `configJson` | Preserves the existing Stocks storage and API contract. |
| Frontend reads ICS file and posts JSON | Reuses `apiClient`, keeps CSRF behavior consistent, and avoids a multipart dependency. |
| Persist raw ICS on `calendar_sources` | Re-import and manual sync use the same source record and remain covered by database backup. |
| Defer local birthday CRUD/export | It needs a first-class entity; browser-only local storage would violate durability and backup expectations. |
| Preserve the restoring admin login | A fresh site already has an authenticated bootstrap admin; reusing that identity avoids putting password hashes in portable files or locking the operator out. |
| Disable other restored passwords | A deliberately non-authenticating stored value forces explicit administrator resets without sharing credentials. |
| Parent-first restore order | Dashboard, OAuth, user preference, calendar, and todo relationships remain valid throughout the transaction. |

## Implementation Phases

| Phase | Scope | Exit criterion |
| --- | --- | --- |
| 01 | Shared mobile surfaces and containment | Targeted UI tests and visual class audit pass |
| 02 | Stocks lot editor | Component tests and frontend typecheck pass |
| 03 | Static ICS storage, parser, routes, and UI | Parser/integration tests and backend typecheck pass |
| 04 | Final quality gates and documentation | Required reviews, lint, and targeted suites pass |
| 05 | Portable backup recovery | Exported JSON restores unchanged in tests and Docker |

## Threat Model

ICS content is untrusted user input. Only authenticated administrators with a valid CSRF
token may create or replace it. The body is limited to 5 MiB, validated before storage,
parsed as calendar data only, and never returned by list/public endpoints. Ownership is
checked before re-import. Static sources perform no outbound network request.

Portable backup files remain credential-free. Restore uses only the authenticated
administrator's existing password hash, never logs it, assigns non-authenticating
password state to other users, strips OAuth/CalDAV credentials even from older backup
files, and invalidates every session transactionally.

## Rollback

The nullable schema columns are backward-compatible. Rolling back application code
leaves unused columns and file-source rows; operators should delete `ical_file` sources
before rollback because older code does not understand that source type.
