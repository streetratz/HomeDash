# Feature Specification: Settings & Config Fixes

**Feature Branch**: `039-settings-config-fixes`  
**Created**: 2026-06-22  
**Status**: Draft  
**Input**: Fix disconnected settings that save but never apply (GH audit from rubber-duck session)

## User Scenarios & Testing

### User Story 1 - Font Settings Apply to Dashboard Title (Priority: P1)

As a dashboard administrator, I want my chosen title font and font size to visually apply to the dashboard header so that my branding customisation is actually visible after saving.

**Why this priority**: This is a user-reported blocking bug. Users configure fonts in settings, see them save successfully, but the dashboard appearance never changes — breaking trust in the entire settings system.

**Independent Test**: Admin selects "Roboto" font at 28px in Appearance settings, saves, then views the public dashboard — the header title renders in Roboto at 28px.

**Acceptance Scenarios**:

1. **Given** an admin has saved `titleFont: "Roboto"` and `titleFontSizePx: 28`, **When** any user loads the dashboard, **Then** the header title renders with `font-family: 'Roboto', sans-serif` at `28px`
2. **Given** an admin has saved `titleFont: "monospace"`, **When** a user loads the dashboard, **Then** the header title renders with the monospace font stack
3. **Given** no font settings have been configured, **When** a user loads the dashboard, **Then** the header title renders with the system default font at the default size
4. **Given** the public bootstrap endpoint is queried, **When** font settings exist in the database, **Then** the response includes `titleFont` and `titleFontSizePx` fields

---

### User Story 2 - Logo Updates Immediately After Upload (Priority: P1)

As an admin, I want my newly uploaded logo to appear on the dashboard immediately after upload without requiring a manual page refresh so that I get instant visual feedback.

**Why this priority**: Stale logo after upload creates confusion — the admin thinks the upload failed when it actually succeeded. This is a cache invalidation bug.

**Independent Test**: Admin uploads a new logo via Appearance settings and the dashboard header displays the new logo without any page refresh.

**Acceptance Scenarios**:

1. **Given** an admin uploads a new logo, **When** the upload succeeds, **Then** the public dashboard displays the new logo within 2 seconds without page refresh
2. **Given** an admin uploads a new logo, **When** the upload succeeds, **Then** both admin and public views show the updated logo immediately

---

### User Story 3 - Repository Link Visible in Footer (Priority: P2)

As a dashboard user, I want to see a "Repository" link in the footer when the admin has configured a repository URL so that I can quickly navigate to the project source.

**Why this priority**: The data is already being stored and exposed — it just needs rendering. Low-effort fix that completes the intended feature.

**Independent Test**: Admin sets repoUrl in shell settings, views the dashboard footer, and sees a clickable "Repository" link pointing to that URL.

**Acceptance Scenarios**:

1. **Given** `repoUrl` is set in shell settings, **When** a user views the dashboard footer, **Then** a "Repository" link is displayed pointing to the configured URL
2. **Given** `repoUrl` is empty or not set, **When** a user views the dashboard footer, **Then** no "Repository" link is shown
3. **Given** `repoUrl` is set, **When** the link is clicked, **Then** it opens in a new tab

---

### User Story 4 - Clock Display Settings Apply Without Home Clock (Priority: P2)

As a user who has configured only "extra" clocks (no home clock entry), I want the clock display settings (12/24-hour format, show seconds, etc.) to still apply so that my display preferences are respected regardless of clock configuration.

**Why this priority**: Users who configure extra clocks but skip the home clock silently lose their display preferences — a confusing behaviour with no error indication.

**Independent Test**: Admin configures clock display to 24-hour format with seconds shown, adds only extra timezone clocks (no home clock), views the dashboard — all clocks display in 24-hour format with seconds.

**Acceptance Scenarios**:

1. **Given** clock display config is set to 24-hour with seconds and only extra clocks exist, **When** the dashboard renders, **Then** all clocks use 24-hour format with seconds displayed
2. **Given** clock display config is set and a home clock also exists, **When** the dashboard renders, **Then** behaviour is unchanged from current (backward compatible)
3. **Given** no clock display config is saved, **When** the dashboard renders, **Then** clocks use sensible defaults (12-hour, no seconds)

---

### User Story 5 - Dead Code Removal: headerStyleTarget (Priority: P3)

As a developer maintaining the codebase, I want unused fields removed from public responses so that the API surface is clean and doesn't confuse future contributors.

**Why this priority**: Housekeeping — reduces cognitive load and API payload size. No user-facing behaviour change. Kept in DB/admin for potential future use.

**Independent Test**: Query GET /api/public/bootstrap and confirm `headerStyleTarget` is absent from the response; confirm admin GET/PUT endpoints still include it.

**Acceptance Scenarios**:

1. **Given** the public bootstrap endpoint is queried, **When** the response is returned, **Then** `headerStyleTarget` is not included in the payload
2. **Given** the admin shell endpoint is queried, **When** the response is returned, **Then** `headerStyleTarget` is still included for future use

---

### User Story 6 - UTC Timezone Validation (Priority: P3)

As a user configuring a clock with "UTC" timezone, I want the system to accept "UTC" as a valid timezone so that I don't receive a validation error for a universally-recognised timezone identifier.

**Why this priority**: Already fixed in code — just needs test coverage to prevent regression.

**Independent Test**: Call the timezone validation function with "UTC" and confirm it returns true.

**Acceptance Scenarios**:

1. **Given** a user enters "UTC" as a timezone value, **When** validation runs, **Then** the timezone is accepted as valid
2. **Given** a user enters "America/New_York", **When** validation runs, **Then** the timezone is accepted as valid
3. **Given** a user enters "Invalid/Timezone", **When** validation runs, **Then** the timezone is rejected as invalid

---

### User Story 7 - Screensaver Settings Use Shared Mutation (Priority: P3)

As a developer, I want screensaver settings to use the same update mechanism as other shell settings so that cache invalidation and optimistic updates behave consistently.

**Why this priority**: Low priority code consistency improvement. Reduces divergent paths and potential future cache bugs.

**Independent Test**: Save screensaver settings, confirm the same query keys are invalidated as other shell settings mutations.

**Acceptance Scenarios**:

1. **Given** an admin saves screensaver settings, **When** the save completes, **Then** the same cache invalidation occurs as for other shell settings changes
2. **Given** an admin saves screensaver settings, **When** the save completes, **Then** the public dashboard reflects screensaver changes without manual refresh

---

### Edge Cases

- What happens when a saved font name doesn't match any available system font? Falls back to the next font in the stack, ultimately to system default.
- What happens when titleFontSizePx is 0 or negative? System ignores invalid values and applies default size.
- What happens when repoUrl contains a malicious or non-HTTP URL? Only http:// and https:// URLs are rendered as links.
- What happens if the logo upload completes but the file isn't immediately available (slow filesystem)? Cache invalidation fires on mutation success; browser will re-fetch and show new image when available.
- What happens when clock display settings are partially configured (some fields missing)? Missing fields use sensible defaults.

## Requirements

### Functional Requirements

- **FR-001**: System MUST include `titleFont` and `titleFontSizePx` in the GET /api/public/bootstrap response when configured
- **FR-002**: The dashboard header title MUST render using the configured font family and size from bootstrap data
- **FR-003**: System MUST support a defined set of font families: system (default), Inter, Roboto, Segoe UI, monospace, serif
- **FR-004**: System MUST invalidate the public bootstrap cache after logo upload completes successfully
- **FR-005**: System MUST render a "Repository" link in the dashboard footer when `repoUrl` is configured with a valid http/https URL
- **FR-006**: The "Repository" footer link MUST open in a new browser tab
- **FR-007**: System MUST NOT include `headerStyleTarget` in the public bootstrap response
- **FR-008**: System MUST retain `headerStyleTarget` in admin shell endpoints for future use
- **FR-009**: System MUST read clock display configuration from shell settings directly, not derive it from the home clock entry
- **FR-010**: System MUST accept "UTC" as a valid timezone identifier
- **FR-011**: Screensaver settings MUST use the shared shell settings mutation for saving
- **FR-012**: System MUST NOT render the "Repository" link when `repoUrl` is empty, null, or uses a non-http(s) scheme
- **FR-013**: System MUST apply a sensible default font (system font) when no font configuration exists

### Key Entities

- **Shell Settings**: Central configuration object holding all dashboard appearance and behaviour settings (title font, font size, logo path, repo URL, header style target, clock config, screensaver settings)
- **Public Bootstrap**: Read-only subset of shell settings exposed to unauthenticated users for dashboard rendering
- **Clock Display Config**: Configuration for clock rendering (format, show seconds, etc.) that applies globally to all displayed clocks

## Success Criteria

### Measurable Outcomes

- **SC-001**: Font changes saved in admin settings are visually applied on the public dashboard within 2 seconds of page load — 100% of the time
- **SC-002**: Logo uploads are reflected on the public dashboard immediately after upload without manual page refresh
- **SC-003**: Repository link is visible in the footer for 100% of dashboards where a valid repoUrl is configured
- **SC-004**: Clock display preferences apply correctly regardless of whether a home clock is configured — verified by clock format rendering matching saved config
- **SC-005**: "UTC" timezone passes validation without error
- **SC-006**: Public bootstrap response payload does not include deprecated `headerStyleTarget` field
- **SC-007**: All settings changes made via admin panel are reflected on the public dashboard without requiring full page refresh

## Assumptions

- The existing font families (system, Inter, Roboto, Segoe UI, monospace, serif) are sufficient — no custom font upload capability is needed
- The logo upload mechanism itself works correctly; only cache invalidation is broken
- "Repository" link placement in the footer is appropriate — no other location was specified
- Clock display config structure already exists in the database schema; only the read path needs fixing
- The screensaver settings consolidation does not require API schema changes, only frontend mutation refactoring
- headerStyleTarget removal from public bootstrap is non-breaking because no frontend code currently consumes it
- All fixes target the existing settings architecture — no new endpoints or database migrations are required
