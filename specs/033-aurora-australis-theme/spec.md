# Feature Specification: Aurora Australis CSS Theme

**Feature Branch**: `033-aurora-australis-theme`  
**Created**: 2025-07-24  
**Status**: Draft  
**Input**: User description: "Create an Aurora Australis-inspired CSS theme with southern lights colour palette — greens, teals, purples, and deep blues with subtle gradient effects. This should be a switchable theme from Settings, implemented as CSS custom properties. Must maintain WCAG AA contrast. Apply consistently to all widget cards, nav, modals. Deep navy backgrounds with green/teal/purple accent gradients."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Activate Aurora Australis Theme (Priority: P1)

A user wants to switch their dashboard appearance to the Aurora Australis theme to enjoy a visually distinctive southern-lights aesthetic while maintaining full readability.

**Why this priority**: Core value proposition — without the ability to select and apply the theme, all other stories are moot.

**Independent Test**: Can be fully tested by navigating to Settings, selecting "Aurora Australis" from theme options, and verifying the dashboard immediately reflects the new colour scheme with deep navy backgrounds and green/teal/purple accents.

**Acceptance Scenarios**:

1. **Given** a user is on the Settings page, **When** they select "Aurora Australis" from the theme picker, **Then** the dashboard background changes to deep navy and accent colours shift to greens, teals, and purples immediately without a page reload.
2. **Given** a user has selected the Aurora Australis theme, **When** they navigate away from Settings and return later (or reload the page), **Then** the Aurora Australis theme remains active.
3. **Given** an unauthenticated user viewing a public dashboard, **When** the dashboard owner has Aurora Australis active, **Then** the public dashboard renders in the Aurora Australis colour scheme.

---

### User Story 2 - Consistent Widget Card Styling (Priority: P2)

A user expects all widget cards, navigation elements, and modals to look cohesive under the Aurora Australis theme — no unstyled or mismatched elements.

**Why this priority**: Inconsistent styling would make the theme feel broken and unfinished, undermining the core experience.

**Independent Test**: Can be tested by activating the theme and visually inspecting each widget type, the navigation bar, and at least one modal dialog to confirm consistent colouring and gradient effects.

**Acceptance Scenarios**:

1. **Given** Aurora Australis is active, **When** the user views any widget card on their dashboard, **Then** the card uses the theme's colour palette (navy card backgrounds, themed borders/accents) with no default-styled cards remaining.
2. **Given** Aurora Australis is active, **When** a modal dialog opens (e.g., add widget, confirm delete), **Then** the modal uses the theme's colour palette consistently with the rest of the UI.
3. **Given** Aurora Australis is active, **When** the user views the navigation/header area, **Then** the nav uses deep navy background with subtle gradient accent effects consistent with the southern-lights palette.

---

### User Story 3 - Accessibility Compliance (Priority: P2)

A user with visual impairments expects all text and interactive elements to remain readable under the Aurora Australis theme, meeting WCAG AA contrast requirements.

**Why this priority**: Accessibility is non-negotiable — a beautiful theme that cannot be read is unusable.

**Independent Test**: Can be tested by running an automated contrast checker against all text/background colour combinations used in the theme and confirming all pass WCAG AA (4.5:1 for normal text, 3:1 for large text).

**Acceptance Scenarios**:

1. **Given** Aurora Australis is active, **When** any text element is measured against its background, **Then** the contrast ratio meets WCAG AA minimum (4.5:1 for normal text, 3:1 for large text and UI components).
2. **Given** Aurora Australis is active with gradient backgrounds, **When** text overlays a gradient area, **Then** the text remains readable at all points across the gradient.
3. **Given** Aurora Australis is active, **When** interactive elements (buttons, links, inputs) are in their various states (hover, focus, disabled), **Then** each state is visually distinguishable and meets contrast requirements.

---

### User Story 4 - Switch Back to Default Themes (Priority: P3)

A user who has tried Aurora Australis wants to switch back to the standard light or dark theme seamlessly.

**Why this priority**: Users must never feel "trapped" in a theme — reversibility builds confidence to experiment.

**Independent Test**: Can be tested by activating Aurora Australis, then switching to light mode, then dark mode, confirming each transition is clean with no leftover Aurora styling.

**Acceptance Scenarios**:

1. **Given** Aurora Australis is currently active, **When** the user selects "Dark" or "Light" from theme options, **Then** the UI immediately reverts to the standard theme with no residual Aurora colours.
2. **Given** a user switches from Aurora Australis to another theme, **When** their preference is persisted, **Then** refreshing the page shows the newly selected standard theme.

---

### Edge Cases

- What happens when a new widget type is added that doesn't have Aurora-specific styles? → Falls back to base dark-theme styling so no content appears unstyled.
- How does the theme handle user-uploaded images or custom widget content? → Images/custom content are unaffected; only UI chrome and framework elements are themed.
- What if a user's browser doesn't support CSS custom properties? → The base dark theme applies as a fallback (CSS custom properties have 97%+ browser support, so this is an extreme edge case).
- How do gradient effects behave on low-powered devices or with reduced-motion preferences? → Gradients are static by default; any animated gradients respect `prefers-reduced-motion: reduce`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an "Aurora Australis" option in the theme selection interface within Settings.
- **FR-002**: System MUST implement the Aurora Australis theme entirely via CSS custom properties so it can be activated by applying a class/attribute to the document root.
- **FR-003**: System MUST persist the user's theme selection (including Aurora Australis) to the server for authenticated users, and to localStorage for unauthenticated users.
- **FR-004**: System MUST apply the Aurora Australis colour palette consistently to: widget cards, navigation/header, modals/dialogs, form inputs, buttons, and all interactive elements.
- **FR-005**: System MUST use deep navy (#0a0e1a to #0f1729 range) as the primary background colour family for the Aurora Australis theme.
- **FR-006**: System MUST use green, teal, and purple as accent colours with subtle gradient effects for decorative elements (borders, dividers, hover states).
- **FR-007**: All text and interactive element colour combinations in the Aurora Australis theme MUST meet WCAG AA contrast ratios (4.5:1 normal text, 3:1 large text/UI components).
- **FR-008**: System MUST respect `prefers-reduced-motion: reduce` by disabling any animated gradient effects in the theme.
- **FR-009**: System MUST allow switching away from Aurora Australis to light or dark themes without residual styling artefacts.
- **FR-010**: System MUST apply the theme without requiring a page reload (immediate client-side switch).

### Key Entities

- **Theme**: Represents a named colour scheme configuration. Attributes: identifier, display name, colour-mode base (dark), CSS custom property definitions.
- **User Preference (theme selection)**: The user's chosen theme stored against their account. Extends the existing `themeMode` concept to support named themes beyond light/dark.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch to and from the Aurora Australis theme in under 2 seconds with no page reload required.
- **SC-002**: 100% of text/background colour pairings in the theme pass WCAG AA contrast ratio validation.
- **SC-003**: All existing widget types render correctly under the Aurora Australis theme with no visual regressions or unstyled elements.
- **SC-004**: Theme preference persists correctly across browser sessions for both authenticated and unauthenticated users.
- **SC-005**: The theme functions correctly across all supported browsers (Chrome, Firefox, Safari, Edge — latest two versions).
- **SC-006**: Users with `prefers-reduced-motion` enabled see no animated effects from the theme.

## Assumptions

- The existing theme system (light/dark toggle) will be extended to support named colour themes rather than replaced — Aurora Australis operates as a dark-mode variant.
- The existing user preferences API and localStorage mechanism will be extended to persist the new theme option.
- The aurora colour palette values (specific hex/HSL codes) will be determined during implementation based on contrast validation; the spec defines the colour families (navy, green, teal, purple) not exact values.
- All current widgets and UI components use Tailwind CSS utility classes and/or CSS custom properties, making them responsive to theme changes via root-level variable overrides.
- Mobile/responsive layouts are already handled; this feature only changes colours and gradients, not layout.
- The theme applies to the dark-mode context only — there is no "Aurora Australis Light" variant.
