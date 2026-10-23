# Feature Specification: Calendar Agenda Today Highlight

**Feature Branch**: `068-calendar-today-highlight`
**Created**: 2026-10-24
**Status**: In Progress
**Input**: Issue #25 — the Calendar widget agenda renders Today, later days, and
the timeline inconsistently compared with the bin collection card.

## User Scenario

As a household member glancing at the Calendar widget, I want today's events to
stand out as clearly as the next bin collection and every day/date label and
timeline marker to be legible, so that I can read the agenda at a glance in
light and dark themes.

## Requirements

- **FR-001**: The agenda group for the browser's current date MUST use the same
  bordered, tinted card treatment as the next collection group, keep the primary
  date badge, and expose `aria-current="date"`. No other day carries it.
- **FR-002**: Day labels and date numbers for every agenda day MUST use
  foreground-based colour at no smaller than `text-xs`, leading with the date
  number.
- **FR-003**: The timeline rail MUST use a theme-aware token visible in both light
  and dark themes. Event dots MUST be solid, at least 10px, and visually separated
  from the rail.
- **FR-004**: Collection grouping, Today/Tomorrow household-timezone semantics
  (spec 065), event ordering, and fullscreen calendar behaviour MUST NOT change.
- **FR-005**: The change introduces no motion and keeps layouts readable from 360px.

## Success Criteria

- **SC-001**: Unit tests prove exactly one Today group carries `aria-current`, the
  highlighted card, and the primary badge, and that the rail no longer uses the
  dark-only `border-white/10`.
- **SC-002**: Frontend unit tests, typecheck, lint, and the upgrade gate pass.
