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

- **FR-001**: Every agenda day MUST start with one compact heading: the date
  number followed by a short uppercase weekday (plus month when it differs from
  Today's). Today's number is larger and bold, its label reads "· Today" in the
  primary colour, and its section exposes `aria-current="date"`; no other day
  carries it and no day is boxed. The heading exposes the full date to assistive
  technology. Today follows the household date when collections are shown and the
  browser date otherwise.
- **FR-002**: Later-day numbers MUST use foreground colour of at least 80% strength.
- **FR-003**: The timeline rail MUST use a theme-aware token visible in both light
  and dark themes. Every row (bin or event) MUST share one pattern: a 26px tinted
  icon disc centred on the rail (stream icon for bins, calendar icon in the source
  colour for events), a full-strength 15px title, a right-aligned time at ≥70%
  strength, a soft ≤10% background tint, no border, and a minimum height of 36px.
- **FR-004**: Bin collections MUST render inside their matching day, as rows on
  that day's rail marked by the stream icon and placed before the day's events.
  The collection timezone is shown once below the agenda. Household Today/Tomorrow
  semantics (spec 065), event ordering, and the fullscreen calendar MUST NOT change.
- **FR-005**: The change introduces no motion and keeps layouts readable from 360px.

## Success Criteria

- **SC-001**: Unit tests prove exactly one unboxed Today section carries
  `aria-current`, the compact and full-date heading text, that rows are tinted and
  unbordered, that collections render inside their matching day before its events,
  that the timezone appears once, and that the rail does not use `border-white/10`.
- **SC-003**: A Playwright test at 360, 390, 768, 1280, and 1920px widths, in light
  and dark themes, proves the Today heading size, bins sharing a section with that
  day's events, heading and row text contrast, 36px unbordered rows, one rail per
  day, icon-on-rail alignment, and no horizontal overflow.
- **SC-002**: Frontend unit tests, typecheck, lint, and the upgrade gate pass.
