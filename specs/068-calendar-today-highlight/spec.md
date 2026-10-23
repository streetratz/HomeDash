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

- **FR-001**: The agenda group for the browser's current date MUST be emphasised by
  the solid primary date badge and a full-strength "Today" label, without a
  surrounding border or tinted box, and expose `aria-current="date"`. No other day
  carries it. The next collection group MUST likewise render without a box.
- **FR-002**: Day labels and date numbers for every agenda day MUST use
  foreground-based colour at no smaller than `text-xs`, leading with the date
  number.
- **FR-003**: The timeline rail MUST use a theme-aware token visible in both light
  and dark themes. Event dots MUST be solid, at least 10px, centred on the rail,
  and carry no ring or outline.
- **FR-004**: Collection grouping, Today/Tomorrow household-timezone semantics
  (spec 065), event ordering, and fullscreen calendar behaviour MUST NOT change.
- **FR-005**: The change introduces no motion and keeps layouts readable from 360px.

## Success Criteria

- **SC-001**: Unit tests prove exactly one Today group carries `aria-current` and
  the primary badge with no border or background box, that dots carry no ring, and
  that the rail no longer uses the dark-only `border-white/10`.
- **SC-003**: A Playwright test at 360, 390, 768, 1280, and 1920px widths, in light
  and dark themes, proves the unboxed Today and next-collection groups, the solid
  badge, label contrast, dot-on-rail alignment, and no horizontal overflow.
- **SC-002**: Frontend unit tests, typecheck, lint, and the upgrade gate pass.
