# Feature Specification: Settings UI Revamp — System Tab + Cron Scheduler

**Feature Branch**: `026-settings-system-tab`  
**Created**: 2025-01-10  
**Status**: Draft  
**GitHub Issue**: #74

## User Scenarios & Testing

### User Story 1 - System Tab Consolidation (Priority: P1)

As an admin, I want infrastructure settings (Timezone, Scheduled Jobs, Backup & Restore) consolidated into a single "System" tab so that General tab stays focused on user preferences.

**Why this priority**: Fixes the core UX problem — admin infrastructure mixed with user prefs.

**Independent Test**: Navigate to Settings → System tab and verify Timezone, Jobs, and Backup sections are all present and functional.

**Acceptance Scenarios**:

1. **Given** an admin user on settings page, **When** they click the "System" tab, **Then** they see Timezone, Scheduled Jobs, and Backup & Restore sections.
2. **Given** a non-admin user, **When** they view settings, **Then** they do NOT see the System tab.
3. **Given** an admin on General tab, **When** they look at the contents, **Then** they only see Theme and Dashboard Preferences (no Timezone or Backup).
4. **Given** a bookmark/deep-link to `?tab=scheduled-jobs`, **When** loaded, **Then** it redirects to `?tab=system` (legacy redirect).

---

### User Story 2 - Human-Friendly Cron Schedule Builder (Priority: P2)

As an admin, I want a visual schedule builder with presets (Every X Minutes, Hourly, Daily, Weekly, Monthly) so I don't need to write raw cron expressions.

**Why this priority**: Makes the scheduler accessible to non-technical admins without removing power-user capabilities.

**Independent Test**: Create/edit a job, use the frequency picker, verify the generated cron expression is correct and the human-readable preview matches.

**Acceptance Scenarios**:

1. **Given** the job create/edit dialog, **When** I select "Daily" and pick "02:00", **Then** the cron expression is set to `0 2 * * *` and preview shows "Runs daily at 2:00 AM".
2. **Given** "Every X Minutes" selected, **When** I pick 15, **Then** cron is `*/15 * * * *` and preview shows "Runs every 15 minutes".
3. **Given** "Hourly" selected, **When** I pick minute 30, **Then** cron is `30 * * * *` and preview shows "Runs hourly at :30".
4. **Given** "Weekly" selected, **When** I pick Monday at 09:00, **Then** cron is `0 9 * * 1`.
5. **Given** "Monthly" selected, **When** I pick day 1 at 03:00, **Then** cron is `0 3 1 * *`.
6. **Given** any preset active, **When** I click "Advanced", **Then** raw cron input is shown pre-populated and editable.
7. **Given** a job with existing cron `0 2 * * *`, **When** I edit it, **Then** the builder auto-detects "Daily at 02:00" and selects that preset.

---

## Non-Functional Requirements

- No backend API changes required (cron expression format stays the same in DB)
- Legacy `?tab=scheduled-jobs` URLs must redirect to `?tab=system`
- Mobile responsive — frequency picker must work on small screens

## Out of Scope

- Backend job scheduler changes
- New job action types
- Notifications/alerts for job failures
