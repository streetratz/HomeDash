# Feature Specification: Settings Unified Navigation

**Feature Branch**: `066-settings-unified-nav`
**Created**: 2026-10-11
**Status**: Draft
**Input**: GitHub issue #22 — "Settings: unify navigation into a single grouped rail (Option A)"

## Scope

Replace the Settings screen's three inconsistent navigation metaphors with a
single grouped navigation model used at every depth, mobile-first. This is a
frontend-only information-architecture refactor: all existing settings content,
admin-only gating, and behavior are preserved. No backend or API changes.

### Problem being solved

`frontend/src/pages/SettingsPage.tsx` renders 9 top-level tabs as a horizontal
segmented control on desktop and a single dropdown below `lg`. Only two tabs
(`Appearance`, `Integrations`) add a *second* navigation metaphor — a vertical
left sidebar on desktop plus their own mobile dropdown. On a phone, reaching a
panel inside those tabs requires operating two stacked dropdowns. The active
sub-panel is held in component `useState`, so a page refresh loses it and
returns the user to the first panel.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One consistent way to navigate settings (Priority: P1)

An administrator opens Settings and moves between any section — top-level or a
nested panel such as Appearance → Clock Strip or Integrations → Docker — using
one navigation model, without encountering a different control style at a
deeper level and without two stacked dropdowns on a phone.

**Why this priority**: This is the core of the request; it removes the primary
source of clunkiness and is the minimum viable slice.

**Independent Test**: On desktop and at 360px, navigate to a leaf panel inside
Appearance and inside Integrations using only the unified navigation; confirm
no second dropdown or alternate control appears.

**Acceptance Scenarios**:

1. **Given** an admin on desktop, **When** they open Settings, **Then** all
   sections and their nested panels are reachable from one grouped navigation
   rail with a single interaction style.
2. **Given** an admin on a 360px phone, **When** they open the navigation and
   choose a nested panel (e.g. Integrations → Docker), **Then** the panel opens
   with a single level of drill-down and no second stacked dropdown.

---

### User Story 2 - Deep links and refresh preserve the exact panel (Priority: P1)

A user on a nested panel refreshes the page or shares/bookmarks the URL and
returns to the exact same panel, not the first panel of its section.

**Why this priority**: The refresh-loses-context bug is a concrete, reported
defect; fixing it is part of making navigation trustworthy.

**Independent Test**: Navigate to Appearance → Screensaver, reload, and confirm
the Screensaver panel is still shown; copy the URL into a new tab and confirm it
opens the same panel.

**Acceptance Scenarios**:

1. **Given** a user viewing a nested panel, **When** they reload the page,
   **Then** the same section and panel are restored from the URL.
2. **Given** a `?tab=` value that is unknown or no longer valid, **When** the
   page loads, **Then** Settings opens the default leaf without error instead
   of a blank or broken panel.
3. **Given** a user without permission for a section encoded in the URL,
   **When** the page loads, **Then** they are redirected to a permitted
   default section rather than shown a forbidden panel.

---

### User Story 3 - Clear, grouped structure (Priority: P2)

An administrator sees the many settings organized into a small number of
meaningful groups so related sections sit together and the destination is easy
to find.

**Why this priority**: Grouping improves findability but the feature is still
usable as a flat unified list without it; hence P2.

**Independent Test**: Confirm the navigation presents the agreed groups with
their member sections and that every pre-existing section appears exactly once.

**Acceptance Scenarios**:

1. **Given** the Settings navigation, **When** an admin scans it, **Then**
   sections are presented under the groups Account, Appearance, Content,
   Access, System, and About, each section appearing exactly once.
2. **Given** a non-admin user, **When** they open Settings, **Then** only
   permitted sections (Account, About) are shown and admin-only groups are
   absent.

---

### Edge Cases

- A URL names a valid section but an unknown panel → fall back to that
  section's first panel without error.
- A URL names an unknown section → fall back to the default (Account) section.
- A non-admin opens a deep link to an admin-only section/panel → redirect to a
  permitted section; never render admin content.
- The software keyboard is open or safe-area insets apply on a phone while the
  drawer is open → primary navigation and the active panel remain reachable.
- Light and dark themes render the navigation with no flash on load and no
  horizontal overflow at any width from ~360px up.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Settings MUST present a single navigation model used for both
  top-level sections and their nested panels, replacing the horizontal tab
  strip and the two bespoke per-tab sidebars.
- **FR-002**: On phones the navigation MUST use a slide-in drawer that reveals
  the grouped sections; choosing a leaf MUST open its panel with no second
  stacked dropdown.
- **FR-003**: Desktop groups MUST be presented non-collapsible (always
  expanded).
- **FR-004**: Navigation MUST organize sections under these groups, each
  pre-existing section appearing exactly once:
  - **Account** — General
  - **Appearance** — Branding, Header & Footer, Clock Strip, Screensaver
  - **Content** — Dashboards, Widgets, Integrations
  - **Access** — Users, Groups & Access
  - **System** — Timezone, Scheduled Jobs, Backup & Restore
  - **About**
- **FR-005**: The active leaf and sub-panel MUST be encoded in the URL using
  the `?tab=<leaf>` parameter plus an optional `?panel=<sub-panel>` for leaves
  that retain internal navigation (currently only Integrations, e.g.
  `?tab=integrations&panel=docker`). Leaf ids MUST be the clean names matching
  the new structure: `general`, `branding`, `header-footer`, `clock-strip`,
  `screensaver`, `dashboards`, `widgets`, `integrations`, `users`, `groups`,
  `timezone`, `scheduled-jobs`, `backup`, `about`. The owning group is derived
  from the leaf and MUST NOT appear in the URL. A reload or shared link MUST
  restore the exact leaf and sub-panel.
- **FR-006**: No legacy URL compatibility shim is kept. There is a single
  resolver: a known clean leaf id opens that leaf; an unknown, empty, or
  retired `?tab=` value falls back to the default leaf without error. Any
  in-app link that deep-links into Settings MUST be updated to the new clean
  leaf ids in this change.
- **FR-007**: All current settings content and controls MUST be preserved
  unchanged in behavior; only their navigation container changes.
- **FR-008**: Admin-only sections MUST remain hidden from non-admin users, and
  a URL naming a section the current user may not access MUST redirect to a
  permitted section without rendering restricted content.
- **FR-009**: Navigation controls MUST meet repository UI standards: >=44px
  touch targets, accessible names, semantic markup, visible focus states, and
  light/dark parity with no load flash.
- **FR-010**: The navigation MUST NOT overflow horizontally at any viewport
  width from ~360px to large desktop.
- **FR-011**: The feature MUST introduce no backend, API, data, or endpoint
  changes.
- **FR-012**: The `Settings → Widgets` section MUST remain present as the
  designated home for per-widget settings (shared seam with #20); this spec
  does not change its current content.

### Key Entities

- **Settings section**: a top-level destination (e.g. General, Dashboards)
  belonging to one group; may contain one or more panels.
- **Settings leaf**: a navigable destination encoded by `?tab=` in the URL
  (e.g. Clock Strip, Integrations). A leaf may optionally contain sub-panels.
- **Settings sub-panel**: the deepest navigable unit within a leaf that retains
  internal navigation (currently only Integrations services); encoded by the
  optional `?panel=` parameter.
- **Navigation group**: a labeled grouping of sections (Account, Appearance,
  Content, Access, System, About) for presentation only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every settings section and nested panel is reachable through one
  navigation model with no alternate control style at any depth.
- **SC-002**: Reaching any nested panel on a 360px phone requires at most one
  level of drill-down (open drawer, choose leaf) with no second dropdown.
- **SC-003**: Reloading or reopening a shared URL restores the exact
  section/panel in 100% of panels.
- **SC-004**: Settings uses clean leaf ids matching the new structure; no
  in-app link points at a retired id, and an unknown or empty `?tab=` value
  resolves to the default leaf without error.
- **SC-005**: Non-admin users can reach only permitted sections; no admin
  content is rendered for them via UI or deep link.
- **SC-006**: UI review against the repository design/accessibility standards
  passes (targets, focus, labels, light/dark), with no horizontal overflow from
  360px upward.

## Assumptions

- "Groups" refers to HomeDash's own local RBAC groups (permissions + user
  membership), not external directory/LDAP/AAD groups; the feature is retained
  under the Access group.
- Account (General) stays a standalone, all-users self-service section and is
  intentionally not merged with the admin-only Access group.
- Existing settings components, their data hooks, and their save/cancel flows
  are reused as-is; this change only relocates their navigation container.
- Icons may continue to be shown per section; exact iconography is a
  presentation detail resolved during implementation.
- The existing `MobileSectionSelect` component may be retired or repurposed if
  the unified drawer supersedes it, provided no behavior regresses.

## Out of scope

- Any change to widget configuration or the dashboard editor (tracked by #20).
- Backend, API, schema, or endpoint changes.
- New settings sections, new settings capabilities, or content rewrites within
  existing panels.
- Release promotion or version tagging mechanics beyond the normal Main Version
  increment.
