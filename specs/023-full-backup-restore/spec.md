# Feature Specification: Full Backup & Restore + Settings Enhancements

**Feature Branch**: `023-full-backup-restore`
**Created**: 2025-07-17
**Status**: Draft
**GitHub Issue**: #60
**Input**: Expand existing backup & restore spec with default timezone setting, login "Remember Me" option, and consolidated scheduled jobs system.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Full System Backup (Priority: P1)

An admin wants to safeguard the entire HomeDash configuration so they can recover quickly if the NAS fails, the data volume is lost, or they migrate to new hardware. They navigate to Settings, click "Download Backup," and receive a single portable file that contains all dashboards, widgets, users, groups, integrations, scheduled jobs, and app settings.

**Why this priority**: Without backup/restore, any hardware failure or migration means complete manual reconfiguration of the entire system. This is the foundational data-safety feature.

**Independent Test**: Can be tested by creating a backup file, inspecting its contents, and verifying all expected data categories are present.

**Acceptance Scenarios**:

1. **Given** an admin is logged in, **When** they click "Download Backup" in Settings, **Then** the system generates and downloads a single file containing all HomeDash state.
2. **Given** a backup file is being generated, **When** the system encounters an integration that has no sensitive tokens, **Then** it includes that integration's configuration in the backup.
3. **Given** a backup file is being generated, **When** the system encounters OAuth tokens or password hashes, **Then** it excludes them from the backup file.
4. **Given** a non-admin user is logged in, **When** they attempt to access the backup functionality, **Then** the system denies access.
5. **Given** an admin clicks "Download Full Backup", **When** the system generates the backup, **Then** it creates a complete SQLite database copy including all credentials and secrets — suitable for disaster recovery.
6. **Given** an admin has configured scheduled backups, **When** the scheduled time arrives, **Then** the system creates both a portable JSON backup and a full SQLite backup in `$HOMEDASH_DATA_DIR/backups/`, applying the configured retention policy (default: keep last 7).
7. **Given** a Docker container has crashed and the data volume is corrupted, **When** the admin copies a full `.db` backup file into the data directory and starts a new container, **Then** the system is fully operational with all users, passwords, OAuth tokens, and integrations intact.

---

### User Story 2 — Full System Restore (Priority: P1)

An admin who has lost their HomeDash data (or is setting up a new instance) uploads a previously exported backup file to restore the entire system to its prior state. The system validates the backup, shows a summary of what will be restored, and requires explicit confirmation before proceeding.

**Why this priority**: Restore is the complement to backup — without it, backups have no value. Together they form the core disaster-recovery capability.

**Independent Test**: Can be tested by restoring a known backup file onto a fresh HomeDash instance and verifying all dashboards, widgets, users, and settings are recreated correctly.

**Acceptance Scenarios**:

1. **Given** an admin uploads a valid backup file, **When** the file is parsed, **Then** the system displays a summary (number of dashboards, users, widgets, etc.) before proceeding.
2. **Given** a backup summary is displayed, **When** the admin confirms the restore, **Then** all existing data is replaced with the backup contents in a single atomic operation.
3. **Given** a restore is in progress, **When** an error occurs during any step, **Then** the entire operation rolls back and no data is changed.
4. **Given** a backup file from a newer version is uploaded, **When** the system detects the version mismatch, **Then** it rejects the file with a clear error message.
5. **Given** a restore completes successfully, **When** the system finishes, **Then** all active sessions are invalidated and users must re-login.
6. **Given** a restored backup omits OAuth tokens, **When** users log back in, **Then** integrations that require re-authentication display a "not configured" status with instructions.

---

### User Story 3 — Default Timezone Setting (Priority: P2)

A user's HomeDash container may run in UTC or a timezone that doesn't match their physical location. The user navigates to Settings → General, selects their local timezone from a dropdown, and all time-dependent features (clock, calendar, scheduled jobs) immediately reflect the chosen timezone.

**Why this priority**: Incorrect time display is a constant source of confusion for home-dashboard users, especially when the container timezone doesn't match the household location. This is a high-visibility quality-of-life improvement.

**Independent Test**: Can be tested by selecting a different timezone and verifying the clock widget, calendar events, and scheduled job times all display in the new timezone.

**Acceptance Scenarios**:

1. **Given** a user opens Settings → General, **When** they view the timezone section, **Then** they see a searchable dropdown listing all standard IANA timezones (e.g., "America/New_York", "Europe/London").
2. **Given** a user selects a new timezone, **When** the setting is saved, **Then** the clock widget, calendar event times, and scheduled job display times all update to reflect the chosen timezone.
3. **Given** no timezone has been explicitly set, **When** a user views time-dependent widgets, **Then** the system falls back to the container's system timezone.
4. **Given** a timezone is set, **When** that setting is included in a backup, **Then** restoring the backup on a different container preserves the user's chosen timezone.

---

### User Story 4 — Login "Remember Me" (Priority: P2)

A household member logs in to HomeDash on a shared family tablet or personal device. They check "Remember me on this machine" so they don't have to re-enter credentials every time the session expires. When unchecked, the session ends when the browser is closed.

**Why this priority**: A home dashboard is typically always-on; forcing frequent re-login on trusted household devices is a friction point. This balances convenience with security for shared environments.

**Independent Test**: Can be tested by logging in with and without "Remember me" checked, then verifying session persistence behavior matches expectations.

**Acceptance Scenarios**:

1. **Given** a user is on the login page, **When** they view the form, **Then** they see a "Remember me on this machine" checkbox (unchecked by default).
2. **Given** a user checks "Remember me" and logs in, **When** they close and reopen the browser, **Then** they remain logged in for up to 30 days.
3. **Given** a user does not check "Remember me" and logs in, **When** they close the browser, **Then** the session cookie is cleared and they must log in again.
4. **Given** a user has an active "Remember me" session, **When** 30 days have elapsed without activity, **Then** the session expires and the user must log in again.
5. **Given** a user has an active "Remember me" session, **When** an admin performs a system restore, **Then** the session is invalidated and the user must log in again.

---

### User Story 5 — Scheduled Jobs Management (Priority: P3)

A user wants to automate recurring tasks — for example, playing a specific Sonos playlist every morning, or syncing calendars on a custom interval. They navigate to Settings → Scheduled Jobs, where all recurring tasks (both system-managed and user-created) are listed in one place. They can create new jobs, edit existing ones, enable/disable them, and see when each job last ran.

**Why this priority**: Currently, recurring tasks are scattered across different parts of the codebase with no unified visibility or control. Consolidating them gives users transparency and the ability to customize automation — a key value proposition for a home dashboard.

**Independent Test**: Can be tested by creating a scheduled job (e.g., "Play Sonos playlist at 7 AM"), verifying it appears in the jobs list, toggling it on/off, and checking the last-run status after the scheduled time.

**Acceptance Scenarios**:

1. **Given** a user opens Settings → Scheduled Jobs, **When** the page loads, **Then** they see a list of all scheduled jobs including both system-defined (e.g., calendar sync) and user-created jobs.
2. **Given** a user clicks "Add Job," **When** they fill out the job form, **Then** they can specify: a name, action type, action parameters, schedule (cron expression or simple time-based), and enabled/disabled status.
3. **Given** a user creates a Sonos playback job, **When** they configure it, **Then** they can select a playlist/favorite, set volume level, choose target speakers, and define the schedule.
4. **Given** a scheduled job exists, **When** a user views the jobs list, **Then** each job shows its name, schedule description (human-readable), enabled/disabled toggle, and last-run status (success, failure, never run).
5. **Given** a scheduled job has failed, **When** the user views its status, **Then** they see a brief error description explaining what went wrong.
6. **Given** a user edits or deletes a job, **When** they confirm the change, **Then** the job is updated/removed immediately and the next scheduled run reflects the change.
7. **Given** scheduled jobs exist, **When** a system backup is created, **Then** all job definitions and their enabled/disabled state are included in the backup.
8. **Given** a timezone is configured, **When** a job is scheduled for "7:00 AM," **Then** it executes at 7:00 AM in the user's configured timezone, not the container's system time.

---

### Edge Cases

- What happens when a backup file exceeds the upload size limit? → The system rejects it with a clear error stating the maximum allowed size.
- What happens when two admins attempt a restore simultaneously? → The system locks during restore; the second attempt receives a "restore already in progress" error.
- What happens when a scheduled job's target (e.g., Sonos speaker) is unavailable at execution time? → The job logs a failure with the reason and remains enabled for the next scheduled run.
- What happens when the configured timezone is removed from the IANA database in a future update? → The system falls back to the container timezone and notifies the user that their timezone setting needs to be updated.
- What happens when a user creates a cron-style schedule with invalid syntax? → The system validates the expression on save and shows a clear error with format guidance.
- What happens when a "Remember me" session is active and the user explicitly logs out? → The long-lived session is immediately invalidated.
- What happens when restoring a backup that contains scheduled jobs referencing integrations not yet configured? → Jobs are restored in a disabled state with a note indicating the missing dependency.

## Requirements *(mandatory)*

### Functional Requirements

**Backup & Restore**

- **FR-001**: System MUST allow admins to download a single backup file containing all HomeDash state (dashboards, widgets, users, groups, integrations, settings, scheduled jobs, todos, calendar sources, photo sources, link lists).
- **FR-002**: System MUST allow admins to upload a backup file and restore the entire system state, replacing all current data atomically.
- **FR-003**: System MUST validate the backup file format and version before attempting a restore.
- **FR-004**: System MUST execute the entire restore within a single database transaction, rolling back completely on any failure.
- **FR-005**: System MUST exclude password hashes and OAuth/refresh tokens from backup files.
- **FR-006**: System MUST invalidate all active sessions after a successful restore.
- **FR-007**: System MUST require explicit confirmation (typing a confirmation word) before executing a restore.
- **FR-008**: System MUST display a summary of backup contents (counts of dashboards, users, widgets, etc.) before restore confirmation.
- **FR-009**: System MUST reject backup files from newer, unsupported versions with a descriptive error.
- **FR-010**: System MUST prevent concurrent restore operations.

**Default Timezone**

- **FR-011**: System MUST provide a searchable timezone dropdown in Settings → General listing all standard IANA timezones.
- **FR-012**: System MUST persist the selected timezone as an application-wide setting.
- **FR-013**: Clock widget, calendar event display times, and scheduled job times MUST respect the configured timezone.
- **FR-014**: When no timezone is explicitly configured, the system MUST fall back to the container's system timezone.
- **FR-015**: The configured timezone MUST be included in backup files and restored correctly.

**Login "Remember Me"**

- **FR-016**: Login form MUST display a "Remember me on this machine" checkbox, unchecked by default.
- **FR-017**: When "Remember me" is checked, the system MUST issue a persistent session lasting 30 days.
- **FR-018**: When "Remember me" is unchecked, the system MUST issue a session-only cookie that expires when the browser is closed.
- **FR-019**: Explicit logout MUST immediately invalidate the session regardless of "Remember me" status.
- **FR-020**: The system MUST NOT extend "Remember me" sessions beyond the 30-day maximum.

**Scheduled Jobs**

- **FR-021**: System MUST provide a "Scheduled Jobs" section in Settings that lists all recurring tasks (system-defined and user-created).
- **FR-022**: Users MUST be able to create custom scheduled jobs specifying: name, action type, action-specific parameters, and schedule.
- **FR-023**: System MUST support both cron-expression and simple time-based scheduling (e.g., "Daily at 7:00 AM").
- **FR-024**: Each job MUST have an enable/disable toggle that takes effect immediately.
- **FR-025**: Each job MUST display its last-run status (success, failure with reason, or never run).
- **FR-026**: Users MUST be able to edit and delete existing jobs.
- **FR-027**: For Sonos playback jobs, users MUST be able to select a playlist/favorite, set volume level (0–100), and choose one or more target speakers.
- **FR-028**: Scheduled jobs MUST execute at times relative to the user's configured timezone (FR-012).
- **FR-029**: All job definitions and their enabled/disabled state MUST be included in system backups and restored correctly.
- **FR-030**: Jobs restored with references to unconfigured integrations MUST be set to disabled with a descriptive note.

### Non-Functional Requirements *(mandatory)*

- **NFR-001 (Security)**: Backup/restore endpoints MUST be restricted to admin users only.
- **NFR-002 (Security)**: "Remember me" sessions MUST be cryptographically tied to the issuing server and invalidated on restore or password change.
- **NFR-003 (LAN-only)**: All features MUST function fully without internet access (timezone list bundled, not fetched remotely).
- **NFR-004 (Privacy)**: No telemetry, analytics, or external callbacks MUST be introduced by any of these features.
- **NFR-005 (UX)**: All new Settings UI sections MUST be usable on both mobile and desktop screen sizes.
- **NFR-006 (Operability)**: Backup, restore, and scheduled job operations MUST produce sufficient logs to diagnose failures on a NAS environment.
- **NFR-007 (Data Safety)**: Backup files MUST be self-contained and not depend on external references to be useful.
- **NFR-008 (Performance)**: Backup generation MUST complete within 10 seconds for a typical HomeDash instance (≤ 20 dashboards, ≤ 100 widgets).

### Key Entities

- **Backup File**: A self-contained portable snapshot of all HomeDash state. Contains a format identifier, schema version, application version, export timestamp, and nested data collections for every restorable entity.
- **Timezone Setting**: An application-wide configuration value (IANA timezone identifier) that governs how time-dependent features display and schedule times. Falls back to the container system timezone when unset.
- **Session**: Represents an authenticated user's login state. Has a type (session-only vs. persistent) and a maximum lifetime (browser-close for session-only; 30 days for "Remember me"). Tied to a specific user and invalidated on logout, restore, or password change.
- **Scheduled Job**: A recurring task definition containing a name, action type (e.g., Sonos playback, calendar sync), action-specific parameters (e.g., playlist, volume, speakers), a schedule (cron or simple time), enabled/disabled flag, and last-run status. Can be system-defined or user-created.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can back up the entire system and restore it onto a fresh HomeDash instance in under 5 minutes.
- **SC-002**: After a restore, 100% of dashboards, widgets, settings, and scheduled jobs match the original system (excluding secrets that require re-authentication).
- **SC-003**: A restore that encounters an error at any point results in zero data loss — the original state is fully preserved.
- **SC-004**: Users can set their timezone and see all time-dependent displays update within 3 seconds.
- **SC-005**: A user who checks "Remember me" remains logged in across browser restarts for up to 30 days without re-entering credentials.
- **SC-006**: A user who does not check "Remember me" is required to log in again after closing and reopening the browser.
- **SC-007**: Users can create, edit, enable/disable, and delete scheduled jobs through the Settings UI without needing to access configuration files or restart the application.
- **SC-008**: Scheduled jobs execute within 60 seconds of their configured time.
- **SC-009**: 90% of users can create a new scheduled job on their first attempt without external help.

## Assumptions

- The IANA timezone list is static enough to be bundled with the application and updated only during application releases.
- The existing Sonos service already provides the playback, volume, and speaker selection capabilities needed for scheduled Sonos jobs; no new Sonos integration work is required.
- "Simple time-based scheduling" covers daily, weekly, and specific-day-of-week patterns, which are sufficient for home automation use cases.
- The existing session cookie mechanism can be extended to support variable TTLs without replacing the authentication architecture.
- Backup files are expected to remain under 10 MB for typical HomeDash instances; larger instances (e.g., with hundreds of widgets) are uncommon.
- System-defined scheduled jobs (e.g., calendar sync) will be converted to use the new unified scheduling system rather than maintaining separate scheduling logic.

## Scope Boundaries

### In Scope

- Full backup of all dashboards, widgets, users, groups, integrations, settings, scheduled jobs, todos, calendar sources, photo sources, and link lists
- Full restore with atomic replace semantics
- Timezone dropdown in Settings → General
- Timezone propagation to clock, calendar, and scheduled jobs
- "Remember me" checkbox on login with 30-day persistent session
- Consolidated Scheduled Jobs section in Settings
- Custom job creation for Sonos playback (and extensible for future action types)
- Job lifecycle management (create, edit, enable/disable, delete, view status)

### Out of Scope

- Uploaded images/photos in backups (too large; users should backup the volume separately)
- Merge-mode restore (future enhancement; only replace-mode in initial release)
- Per-user timezone preferences (single application-wide timezone for initial release)
- Scheduled job action types beyond Sonos playback and calendar sync (architecture supports extension but only these two are in scope)
- Push notifications for job failures (users check status in the UI)
- Automated/scheduled backups (manual download only for initial release)
