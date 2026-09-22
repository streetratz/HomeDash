# Feature Specification: Dashboard Enhancements

**Feature Branch**: `003-dashboard-enhancements`  
**Created**: 2026-04-24  
**Status**: Draft  
**Input**: GitHub Issues #4 (Visual Icon Picker), #5 (Background Customization), #6 (Dashboard Import/Export)

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Visual Icon Picker for Links (Priority: P1)

An admin is editing a link in a dashboard. Instead of manually typing a Lucide icon name into a text field, they click an icon selector button that opens a modal dialog. The dialog displays a searchable grid of all available Lucide icons. The admin types "server" into the search box and sees matching icons filtered in real time. They click the desired icon, the modal closes, and the link's icon updates to their selection. When they save, the new `iconKey` persists.

**Why this priority**: The current text-based icon input requires users to know exact Lucide icon names, which is unintuitive and error-prone. A visual picker dramatically improves the link editing experience.

**Independent Test**: Can be fully tested by entering edit mode, opening a link's edit form, clicking the icon picker, searching for and selecting an icon, saving, and confirming the icon renders correctly on the link.

**Acceptance Scenarios**:

1. **Given** an admin is editing a link, **When** they click the icon selector button, **Then** a modal opens displaying a grid of Lucide icons.
2. **Given** the icon picker modal is open, **When** the admin types a search term, **Then** the grid filters icons whose names match the search in real time.
3. **Given** icons are filtered, **When** the admin clicks an icon, **Then** the modal closes and the link's icon field updates to the selected icon's name.
4. **Given** an icon has been selected, **When** the admin saves the link, **Then** the selected icon renders correctly on the dashboard.
5. **Given** the icon picker modal is open, **When** the admin clicks outside or presses Escape, **Then** the modal closes without changing the icon.

---

### User Story 2 — Dashboard Background Customization (Priority: P1)

An admin wants to personalize a dashboard's appearance. They open the dashboard settings and see background options: solid color or image. For solid color, they use a color picker to choose a hex color. For image, they upload an image file (or select a previously uploaded asset) and choose a display mode (cover, contain, or tile). A live preview shows the background before saving. When saved, the dashboard renders with the configured background.

**Why this priority**: Background customization is a highly visible personalization feature that leverages already-existing backend schema and asset upload infrastructure — high user value with minimal backend work.

**Independent Test**: Can be tested by opening dashboard settings, selecting a background type, configuring it (color picker or image upload + display mode), saving, and verifying the dashboard renders with the configured background.

**Acceptance Scenarios**:

1. **Given** an admin opens dashboard settings, **When** they select "Solid Color" background type, **Then** a color picker appears and they can choose a hex color.
2. **Given** an admin selects "Image" background type, **When** they upload an image, **Then** the image is stored via the existing asset upload endpoint and linked to the dashboard.
3. **Given** an image background is selected, **When** the admin chooses a display mode (fill or stretch), **Then** a live preview shows the image with the selected display mode applied.
4. **Given** background settings have been configured, **When** the admin saves, **Then** the dashboard renders with the configured background on reload.
5. **Given** a dashboard has an image background, **When** the admin switches to "Solid Color," **Then** the image background is removed and replaced with the selected color.

---

### User Story 3 — Dashboard Export (Priority: P2)

An admin wants to back up a dashboard configuration. They navigate to dashboard settings and click an "Export" button. The system generates a JSON file containing the complete dashboard definition — metadata, placeholders, widgets, and links — and triggers a browser download. The exported JSON is human-readable and self-contained.

**Why this priority**: Export is the simpler half of backup/restore and can be delivered independently. It gives users confidence that their configuration is portable.

**Independent Test**: Can be tested by clicking export on a dashboard with placeholders, widgets, and links, then verifying the downloaded JSON contains all expected data in the correct structure.

**Acceptance Scenarios**:

1. **Given** a dashboard with placeholders, widgets, and links exists, **When** the admin clicks "Export," **Then** a JSON file is downloaded with the filename `{dashboard-slug}-export.json`.
2. **Given** the exported JSON, **When** inspected, **Then** it contains the dashboard name, slug, background settings, all placeholders with layout, all widgets with type and config, and all links with URL and icon.
3. **Given** a dashboard has no placeholders, **When** the admin exports it, **Then** the JSON still downloads with an empty placeholders array.
4. **Given** the export endpoint, **When** called without admin authentication, **Then** it returns 401.

---

### User Story 4 — Dashboard Import (Priority: P2)

An admin wants to restore a dashboard from a previously exported JSON file. They click an "Import Dashboard" button, select a JSON file, and the system validates the file structure. If a dashboard with the same slug already exists, the system prompts for a new name/slug. On confirmation, the system creates the dashboard with all its placeholders, widgets, and links. The imported dashboard appears in the dashboard list.

**Why this priority**: Import completes the backup/restore workflow. It depends on the export format being defined first but is independently testable.

**Independent Test**: Can be tested by importing a valid export JSON, verifying the dashboard is created with all children, then importing the same file again to verify conflict handling.

**Acceptance Scenarios**:

1. **Given** a valid export JSON file, **When** the admin uploads it via the import UI, **Then** a new dashboard is created with all placeholders, widgets, and links intact.
2. **Given** a dashboard with the same slug already exists, **When** the admin imports a JSON with that slug, **Then** the system prompts the admin to provide a new name and auto-generates a unique slug.
3. **Given** an invalid or malformed JSON file, **When** the admin attempts import, **Then** the system displays a clear validation error without creating any partial data.
4. **Given** a valid import, **When** complete, **Then** the imported dashboard appears in the dashboard list and is fully navigable.
5. **Given** the import endpoint, **When** called without admin authentication or CSRF token, **Then** it returns 401/403.

---

### Edge Cases

- What happens when the icon picker has hundreds of icons? — The grid is virtualized or paginated, and search narrows results quickly.
- What happens when the admin searches for an icon name that doesn't exist? — The picker shows an empty state with "No icons found" message.
- What happens when the admin uploads an image that exceeds the size limit? — The existing asset upload endpoint returns 413 and the UI shows the error.
- What happens when an export JSON references asset IDs that don't exist on the target system? — Import creates the dashboard structure but background image references may be null; the dashboard still functions with a default background.
- What happens when the import JSON has an unexpected schema version? — The system validates against the expected schema and rejects unrecognized formats with a descriptive error.
- What happens when the admin cancels a background change without saving? — Changes are discarded; the previous background remains.

## Requirements *(mandatory)*

### Functional Requirements

**Icon Picker**

- **FR-001**: System MUST provide a visual icon picker dialog that displays available Lucide icons in a searchable grid.
- **FR-002**: Icon picker MUST support real-time search/filter by icon name.
- **FR-003**: Icon picker MUST display icons in a responsive grid layout (multi-column desktop, fewer columns mobile).
- **FR-004**: Selecting an icon in the picker MUST update the link's `iconKey` field and close the dialog.
- **FR-005**: Icon picker MUST show the currently selected icon highlighted or indicated.
- **FR-006**: Icon picker MUST be accessible via keyboard navigation (arrow keys, Enter to select, Escape to close).

**Background Customization**

- **FR-007**: System MUST allow admins to configure a dashboard's background type as "Solid Color" or "Image" via the dashboard settings UI.
- **FR-008**: Solid color mode MUST provide a color picker that produces a valid hex color value.
- **FR-009**: Image mode MUST allow uploading a background image via the existing asset upload endpoint (`POST /api/admin/assets`).
- **FR-010**: Image mode MUST allow selecting a display mode (fill or stretch) per the existing schema.
- **FR-011**: Background settings MUST show a live preview before saving.
- **FR-012**: Background settings MUST be persisted via the existing dashboard update endpoint (PUT /api/admin/dashboards/:id).

**Dashboard Export**

- **FR-013**: System MUST provide a GET endpoint that returns a complete dashboard as a JSON document.
- **FR-014**: The export JSON MUST include: dashboard metadata (name, slug, background settings), all placeholders (layout, style), all widgets (type, config, order), and all links (title, URL, iconKey, order).
- **FR-015**: The export endpoint MUST require admin authentication.
- **FR-016**: The frontend MUST trigger a browser file download with filename `{slug}-export.json`.

**Dashboard Import**

- **FR-017**: System MUST provide a POST endpoint that accepts a dashboard export JSON and creates a new dashboard with all children.
- **FR-018**: The import endpoint MUST validate the JSON structure before creating any records.
- **FR-019**: The import MUST handle slug conflicts by requiring a new name when a slug collision is detected.
- **FR-020**: The import MUST be atomic — either all records are created or none (transaction).
- **FR-021**: The import endpoint MUST require admin authentication and CSRF token.
- **FR-022**: The frontend MUST provide a file upload UI with validation feedback and conflict resolution dialog.

### Non-Functional Requirements *(mandatory)*

- **NFR-001 (Security)**: All mutation endpoints (import, background update) MUST require `requireAdmin` + CSRF assertion, consistent with existing admin routes.
- **NFR-002 (LAN-only)**: All features in this spec operate fully within the LAN — no external API calls required.
- **NFR-003 (UX)**: Icon picker and background settings MUST be usable on mobile viewports (≥ 320px width).
- **NFR-004 (Performance)**: Icon picker search MUST respond within 100ms for the full Lucide icon set (~1500 icons).
- **NFR-005 (Data Integrity)**: Dashboard import MUST be transactional — partial failures MUST NOT leave orphaned records.
- **NFR-006 (Compatibility)**: Export format MUST be forward-compatible — unknown fields are ignored on import.

### Key Entities

- **Icon Entry**: A Lucide icon identified by its string name (e.g., "server", "home", "globe"). Used as the `iconKey` on links. No database representation — icons are bundled with the frontend.
- **Dashboard Background**: Configuration stored in the existing `dashboards` table: `backgroundType` (solid/image), `backgroundColor` (hex), `backgroundAssetId` (FK to `uploaded_assets`), `backgroundDisplayMode` (fill/stretch).
- **Dashboard Export Document**: A JSON representation of a complete dashboard including metadata, placeholders array, nested widgets array, and nested links array. Used for backup and restore.

## Assumptions

- The Lucide React icon library is already bundled with the frontend and provides a way to enumerate all available icon names programmatically (via `icons` export from `lucide-react`).
- The existing dashboard update endpoint (PUT /api/admin/dashboards/:id) already accepts `backgroundType`, `backgroundColor`, `backgroundAssetId`, and `backgroundDisplayMode` fields — no backend changes needed for background customization.
- The existing asset upload endpoint handles image validation, size limits, and storage — background image upload reuses this infrastructure.
- Export/import only covers dashboard structure and configuration — uploaded assets (background images, cached favicons) are NOT included in the export JSON. Asset references may be null on import if the target system doesn't have the same assets.
- The export JSON format includes a version field for future compatibility.

## Out of Scope

- Exporting/importing uploaded asset binary files (images) as part of the JSON
- Bulk import of multiple dashboards in a single operation
- Dashboard duplication (clone) — related but distinct from import/export
- Icon upload or custom icon support (only Lucide built-in icons)
- Background video or animated backgrounds
- Background image cropping or editing within the UI
- Cross-instance dashboard sharing (import/export is file-based, not networked)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can select a Lucide icon from the visual picker and see it render on a link within 30 seconds of opening the picker.
- **SC-002**: Icon picker search returns filtered results within 100ms for any search term across the full Lucide icon set.
- **SC-003**: An admin can configure a dashboard background (solid color or image) and see the result applied after saving.
- **SC-004**: Background preview accurately reflects the final rendered appearance before the admin saves.
- **SC-005**: An admin can export a dashboard with 10+ placeholders and 20+ links as a valid JSON file under 1 second.
- **SC-006**: An admin can import a previously exported JSON and see the resulting dashboard with all placeholders, widgets, and links intact.
- **SC-007**: Importing a JSON with a conflicting slug prompts for a new name and successfully creates the dashboard with the new slug.
- **SC-008**: All import/export endpoints reject unauthenticated requests with 401 and missing CSRF with 403.

## Safety Constraints

- Import endpoint MUST validate JSON schema strictly — reject payloads with unexpected types or missing required fields to prevent injection of malformed data.
- Import MUST use a database transaction so that failures mid-import do not leave orphaned records.
- Background image uploads go through the existing asset upload pipeline, which enforces magic-byte validation and size limits.
- Icon picker is purely frontend — no user-supplied icon names are executed or rendered as HTML; icon names are looked up against the Lucide registry.
- Export endpoint MUST NOT leak sensitive data (passwords, tokens) — dashboards contain only structural/display configuration.
