# Feature Specification: Dashboard Duplication

**Feature Branch**: `011-dashboard-duplication`  
**Created**: 2025-07-24  
**Status**: Draft  
**GitHub Issue**: [#25](https://github.com/streetratz/HomeDash/issues/25)  
**Input**: User description: "Allow admins to duplicate an existing dashboard, copying all widgets, links, placeholders, layout, and settings to a new dashboard."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Duplicate a Dashboard (Priority: P1)

As an admin, I want to duplicate an existing dashboard so that I get an independent copy with all its widgets, links, placeholders, layout, and settings — ready for immediate editing without affecting the original.

**Why this priority**: This is the core value of the feature. Without the ability to duplicate a dashboard and get a complete, editable copy, no other story delivers value.

**Independent Test**: Can be fully tested by selecting any existing dashboard, triggering the duplicate action, and verifying the new dashboard appears with all content copied and a unique name.

**Acceptance Scenarios**:

1. **Given** an admin is viewing the dashboard management UI with at least one dashboard, **When** they select the "Duplicate" action on a dashboard, **Then** a new dashboard is created containing copies of all widgets (with their configurations), links, placeholders, layout positions, and background settings.
2. **Given** a dashboard named "Living Room" is duplicated, **When** the duplication completes, **Then** the new dashboard is named "Living Room (Copy)" and has a unique ID distinct from the original.
3. **Given** a dashboard has been duplicated, **When** the admin inspects the original dashboard, **Then** it remains completely unchanged — no widgets, links, settings, or layout positions have been modified.
4. **Given** a dashboard has been duplicated, **When** the admin opens the new copy, **Then** they can immediately edit its name, widgets, layout, and settings without any additional steps.

---

### User Story 2 - Duplicate Dashboard with Unique Naming (Priority: P2)

As an admin, I want the system to handle naming conflicts gracefully when I duplicate a dashboard — especially when duplicating a dashboard that was already a copy — so that each copy has a distinguishable name.

**Why this priority**: Naming collisions would cause confusion when managing multiple dashboards. This builds on P1 to ensure a clean user experience.

**Independent Test**: Can be tested by duplicating a dashboard multiple times and verifying each copy receives a unique, distinguishable name.

**Acceptance Scenarios**:

1. **Given** a dashboard named "Living Room (Copy)" already exists, **When** the admin duplicates "Living Room" again, **Then** the new dashboard is named "Living Room (Copy 2)" (or another distinguishable name that avoids collision).
2. **Given** a dashboard named "Living Room (Copy)" is itself duplicated, **When** the duplication completes, **Then** the new copy has a distinct name such as "Living Room (Copy) (Copy)" or "Living Room (Copy 2)" that does not overwrite any existing dashboard.

---

### User Story 3 - Discover and Access Duplicate Action (Priority: P3)

As an admin, I want the "Duplicate" action to be easily discoverable in the dashboard management UI so that I don't have to search for how to copy a dashboard.

**Why this priority**: Discoverability improves adoption. The feature must be easy to find, but P1 and P2 deliver the core functional value first.

**Independent Test**: Can be tested by navigating to the dashboard management UI and verifying the Duplicate action is visible and accessible for each dashboard listed.

**Acceptance Scenarios**:

1. **Given** an admin is on the dashboard management screen, **When** they look at actions available for any dashboard, **Then** a "Duplicate" option is visible alongside other management actions (e.g., edit, delete).
2. **Given** an admin triggers the "Duplicate" action, **When** the duplication is in progress, **Then** the admin receives clear feedback (e.g., a loading indicator or success notification) that the operation is underway or complete.

---

### Edge Cases

- What happens when a dashboard with an extremely long name is duplicated? The system should truncate or handle the appended " (Copy)" suffix gracefully without breaking the UI or exceeding any name length constraints.
- What happens if the admin rapidly clicks "Duplicate" multiple times on the same dashboard? The system should prevent creating unintended multiple copies (e.g., debounce or disable the button during processing).
- What happens when duplicating a dashboard that has no widgets, links, or placeholders (an empty dashboard)? The system should create a valid empty copy with the dashboard settings and layout preserved.
- What happens if a duplication fails mid-process (e.g., due to a storage error)? The system should not leave a partially created dashboard — the operation should be atomic (all-or-nothing) and display an error message to the admin.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a "Duplicate" action for each dashboard in the dashboard management UI.
- **FR-002**: System MUST create a new dashboard with a unique ID that is fully independent from the original (no shared references or links back to the source).
- **FR-003**: System MUST copy all of the following from the source dashboard to the new copy: dashboard name (with " (Copy)" suffix), layout grid positions, all widgets with their individual configurations, all links, all placeholders, and background settings.
- **FR-004**: System MUST assign the new dashboard a name following the pattern "[Original Name] (Copy)", with automatic conflict resolution when that name already exists (e.g., appending a number: "(Copy 2)", "(Copy 3)").
- **FR-005**: System MUST leave the original dashboard completely unchanged after duplication — no modifications to its name, widgets, links, placeholders, layout, or settings.
- **FR-006**: System MUST make the duplicated dashboard immediately editable upon creation — the admin should be able to rename it, rearrange widgets, and modify settings without any extra activation step.
- **FR-007**: System MUST perform the duplication atomically — if any part of the copy fails, no partial dashboard should be persisted.
- **FR-008**: System MUST restrict the duplicate action to admin users only, consistent with existing dashboard management permissions.
- **FR-009**: System MUST provide visual feedback to the admin during and after the duplication (e.g., loading state, success notification, or error message).

### Non-Functional Requirements *(mandatory)*

- **NFR-001 (Security)**: Feature MUST not reduce authentication/authorization guarantees. Only admins who can manage dashboards may trigger duplication.
- **NFR-002 (LAN-only)**: Feature MUST not require internet access for core function. Duplication operates entirely within the local network.
- **NFR-003 (Privacy)**: Feature MUST not add telemetry/external callbacks by default.
- **NFR-004 (UX)**: Feature UI MUST remain usable on mobile and desktop. The Duplicate action must be accessible on both form factors.
- **NFR-005 (Operability)**: Feature MUST have sufficient logs/errors to diagnose issues on NAS. Duplication failures should be logged with relevant context (source dashboard ID, error details).
- **NFR-006 (Performance)**: Duplication of a dashboard with up to 50 widgets should complete within 3 seconds as perceived by the user.

### Key Entities

- **Dashboard**: The top-level entity being duplicated. Key attributes: unique identifier, name, layout configuration, background settings. A dashboard contains zero or more widgets, links, and placeholders.
- **Widget**: An individual component within a dashboard. Key attributes: type, position within the layout grid, widget-specific configuration. Widgets are fully copied with their configurations during duplication.
- **Link**: A navigation item associated with a dashboard. Key attributes: target URL/destination, display label, position. Fully copied during duplication.
- **Placeholder**: A reserved space or default content block within the dashboard layout. Key attributes: position, placeholder type/content. Fully copied during duplication.
- **Background Settings**: Visual customization for the dashboard (e.g., color, image). Copied as part of the dashboard duplication.

## Assumptions

- The existing dashboard management UI already supports listing dashboards with contextual actions (edit, delete). The "Duplicate" action will be added alongside these.
- Admin role and permissions are already enforced for dashboard management operations. Duplication will leverage the same authorization checks.
- Dashboard names have a reasonable maximum length. The " (Copy)" suffix (up to ~12 additional characters for conflict resolution) will respect this limit.
- Widgets are self-contained — they do not reference external state that would break when copied to a new dashboard context.
- The duplication is a one-time deep copy. There is no ongoing synchronization between the original and the copy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can duplicate any dashboard and have a fully functional, independent copy available within 3 seconds.
- **SC-002**: 100% of dashboard content (widgets, links, placeholders, layout, background settings) is present in the duplicated copy as verified by comparison.
- **SC-003**: The original dashboard shows zero changes after any number of duplication operations.
- **SC-004**: Admins can complete the entire duplicate-and-rename workflow (duplicate a dashboard, rename the copy) in under 30 seconds.
- **SC-005**: The duplicate action is discoverable — admins can find and use it without documentation or guidance on their first attempt.
