# Feature Specification: Mobile Widget Data Management

**Feature Branch**: `046-mobile-widget-data-management`  
**Created**: 2026-09-19  
**Status**: In Progress  
**Issues**: #214, #215, #180, #216, #217

## Summary

Restore the configured dashboard background on mobile by replacing hard-coded opaque
widget panels with a shared translucent surface, make imported Stocks holdings fully
editable, add static ICS file import/re-import for birthday calendars, and make portable
configuration backups restorable into a freshly bootstrapped installation.

## User Stories

### US-1 — Preserve dashboard backgrounds on mobile (P1)

As a dashboard user, I want widget readability panels to remain contained and
translucent so the configured dashboard background remains visible between and behind
widgets.

**Acceptance scenarios**

1. At 360px and 390px widths, Pi-hole, Stocks, Calendar, and multi-widget placeholders
   use the same theme-aware translucent panel treatment.
2. Inner panels do not paint outside their placeholder's rounded boundary.
3. Light and dark themes keep readable text and visible focus states.

### US-2 — Edit Stocks holdings after import (P1)

As an administrator, I want to inspect and edit imported lots so CSV import is an
accelerator rather than the only way to manage a portfolio.

**Acceptance scenarios**

1. Each ticker exposes its quantity, purchase price, and trade date lots.
2. A lot can be added, edited, and removed.
3. Tickers and groups can be added and removed without another CSV import.
4. Invalid or incomplete lot values cannot be saved into widget configuration.
5. Existing imported configuration remains compatible.

### US-3 — Import a static birthday ICS file (P1)

As an administrator, I want to upload a local ICS file and re-upload it later so
read-only birthday calendars can appear in HomeDash without a publishable URL.

**Acceptance scenarios**

1. An admin can create an `ical_file` source from a bounded ICS upload.
2. Yearly all-day events are expanded into the Calendar widget's active date window.
3. Re-uploading replaces the source's cached events.
4. Existing OAuth and URL-based iCal sources are unchanged.
5. Import and re-import require admin authorization and CSRF protection.

### US-4 — Restore a portable backup into a fresh installation (P1)

As an administrator, I want a portable JSON backup to restore without embedded
passwords or tokens so I can recover configuration on a new HomeDash installation
without weakening backup security.

**Acceptance scenarios**

1. A backup produced by **Download Backup** restores without manual JSON changes.
2. The authenticated restoring administrator keeps the same username and password.
3. Other restored users cannot authenticate until an administrator resets their
   passwords.
4. Dashboard, calendar, todo, OAuth-account, and photo-source relationships restore
   without foreign-key failures.
5. OAuth and CalDAV credentials remain excluded and require re-authentication.

## Requirements

### Functional

- **FR-001**: Widget inner panels MUST use one shared theme-aware surface class rather
  than component-specific black backgrounds.
- **FR-002**: Mobile placeholders MUST clip child painting to their rounded boundary
  while allowing pill titles to remain visible.
- **FR-003**: The Stocks editor MUST display every configured lot.
- **FR-004**: The Stocks editor MUST support add, edit, and remove operations for lots.
- **FR-005**: Stock quantities and purchase prices MUST be finite positive numbers.
- **FR-006**: New and edited Stock trade dates MUST be valid ISO calendar dates;
  CSV imports MUST normalize supported Yahoo date formats and omit invalid lots without
  dropping the ticker.
- **FR-007**: Existing CSV import MUST continue to replace/synchronize a matching group.
- **FR-008**: Calendar sources MUST support the `ical_file` type with persisted ICS
  content and optional original filename.
- **FR-009**: URL and file sources MUST share the same ICS parser.
- **FR-010**: Uploaded ICS content MUST be no larger than 5 MiB, MUST contain a valid
  VCALENDAR payload, and every VEVENT MUST have a non-empty UID.
- **FR-011**: File sources MUST not participate in scheduled URL polling, but stored
  content MUST be reparsed locally so recurring events continue advancing into the
  materialized event window.
- **FR-012**: File sources MUST support explicit re-import, and a failed re-import MUST
  preserve the previous file content and cached events.
- **FR-013**: Imported source content MUST never be returned by source-list endpoints.
- **FR-014**: Portable backup exports MUST omit password hashes, sessions, OAuth and
  CalDAV credentials, integration client secrets, Pi-hole API tokens, and UniFi
  usernames/passwords.
- **FR-015**: Restore MUST preserve the authenticated administrator's username,
  display name, and password hash without writing that hash into the backup file.
- **FR-016**: Other restored users MUST receive a non-authenticating password state
  until an administrator resets their password.
- **FR-017**: Restore insertion and deletion MUST follow foreign-key dependency order.
- **FR-018**: OAuth, CalDAV, Pi-hole, UniFi, and client-secret-backed integrations MUST
  restore in a re-authentication-required state without malformed encrypted values.
- **FR-019**: References to unavailable excluded uploaded assets MUST be cleared.
- **FR-020**: Database integrity failures MUST roll back atomically and return an
  actionable validation response instead of a generic server error.

### Non-functional

- **NFR-001**: All controls remain usable at 360px with touch-sized primary actions.
- **NFR-002**: No new runtime dependency is introduced.
- **NFR-003**: Durable calendar data is server-side and included in SQLite
  backup/restore; browser localStorage is not used.
- **NFR-004**: New state-changing routes require admin authorization and CSRF.
- **NFR-005**: Existing widget config and calendar source rows migrate without data
  loss.
- **NFR-006**: A portable backup produced by the current application MUST round-trip
  through a fresh bootstrapped installation.
- **NFR-007**: Before pull request creation and merge, a Docker image built from the
  candidate worktree MUST upgrade a populated database created by `main` without
  changing pre-existing configuration rows or introducing foreign-key violations.

## Deferred Scope

Birthday CSV import, manual birthday records, and CSV/ICS export remain part of #180
Phase 2. They require a dedicated local birthday entity and are not emulated with
browser-only storage in this phase.

## Success Criteria

- **SC-001**: Mobile screenshots no longer show hard black panels replacing the
  configured dashboard background.
- **SC-002**: An imported Stocks portfolio can be maintained without editing the CSV.
- **SC-003**: A static yearly birthday ICS file can be imported and refreshed without
  a URL.
- **SC-004**: Targeted frontend and backend tests, typechecks, and lint pass.
- **SC-005**: The supplied production portable backup restores in Docker with its
  dashboard, ten widgets, relationships, and sanitized integration credentials intact.
