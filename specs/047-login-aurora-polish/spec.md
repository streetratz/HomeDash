# Feature Specification: Login and Aurora Polish

**Feature Branch**: `047-login-aurora-polish`
**Created**: 2026-09-19
**Status**: In Progress
**Issues**: #218, #122

## Summary

Add the conventional accessible show/hide control to the login password field and
upgrade the existing Aurora Borealis/Australis header and placeholder effects from
single moving gradients to restrained multi-layer CSS curtains.

## User Stories

### US-1 — Verify a login password before submitting (P1)

As a user, I want to reveal and re-mask the password I entered so I can correct typing
mistakes without clearing the field.

**Acceptance scenarios**

1. The password field includes an eye/eye-off button inside its right edge.
2. The button toggles only the input type, preserves the entered value, and never
   submits the form.
3. Its accessible name changes between `Show password` and `Hide password`.
4. Keyboard, focus, password-manager, and mobile behavior remain intact.

### US-2 — Use richer Aurora backgrounds without excessive device cost (P1)

As a dashboard user, I want the existing Aurora effects to resemble layered flowing
light curtains while remaining readable and suitable for an always-on dashboard.

**Acceptance scenarios**

1. Existing Aurora Borealis and Aurora Australis choices gain multiple independently
   positioned color bands rather than one flat gradient.
2. Header, placeholder preview, saved placeholder, and screensaver surfaces retain
   readable foreground content and rounded clipping.
3. Motion uses CSS transform/opacity animation and stops under
   `prefers-reduced-motion: reduce`.
4. Existing stored style identifiers and settings contracts remain unchanged.

## Requirements

### Functional

- **FR-001**: The login password control MUST be a non-submit button inside the input
  boundary.
- **FR-002**: Toggling visibility MUST preserve the password value, field name, and
  `autocomplete="current-password"`.
- **FR-003**: The toggle MUST expose a state-specific accessible label and icon.
- **FR-004**: Aurora header backgrounds MUST render layered Borealis/Australis curtains
  behind all interactive header content.
- **FR-005**: Aurora placeholder surfaces MUST render layered curtains behind hosted
  content and preserve clipping at rounded edges.
- **FR-006**: Existing `aurora` and `aurora-australis` persisted values MUST remain
  compatible; no schema or API change is permitted.
- **FR-007**: Reduced-motion users MUST receive a static layered composition with no
  curtain or star animation.

### Non-functional

- **NFR-001**: Controls MUST remain usable at 360px and provide a minimum 40px toggle
  target without shrinking the password text area excessively.
- **NFR-002**: No runtime dependency or database migration is introduced.
- **NFR-003**: Password text MUST remain component-local and MUST NOT be persisted,
  logged, or copied elsewhere.
- **NFR-004**: Aurora animation MUST use CSS only and animate transform/opacity for the
  new curtain layers.

## Success Criteria

- **SC-001**: Automated UI coverage proves the password value survives reveal/re-mask
  and the accessible label changes correctly.
- **SC-002**: Both Aurora variants display at least three color bands in header and
  placeholder surfaces.
- **SC-003**: Reduced-motion CSS disables all Aurora movement.
- **SC-004**: Frontend tests, typecheck, build, review gates, and full lint pass.
