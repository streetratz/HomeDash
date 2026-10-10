# Spec Changelog — Bin Collection Calendar

## Table of Contents

- [CH-01 : Specify independent bin collection schedules](#ch-01--specify-independent-bin-collection-schedules--2026-oct-10-1033-utc11)
- [CH-02 : Confirm existing calendar bin presentation](#ch-02--confirm-existing-calendar-bin-presentation--2026-oct-10-1047-utc11)
- [CH-03 : Expand to custom all-day events](#ch-03--expand-to-custom-all-day-events--2026-oct-10-1346-utc11)

---

## CH-01 : Specify independent bin collection schedules : 2026-Oct-10 1033 UTC+11

**Type**: New document / New FR / New SC  
**Summary**: Create the issue #19 specification from the repository template,
preserving the owner-requested preset and grounding independent schedules, date
exceptions, and seasonal scope in official AU/NZ and international evidence.

| ID | Description |
| --- | --- |
| US1 / FR-001–FR-004 | Define preset/custom entry, confirmed timezone, normal-date anchor, and four-week preview; distinguish owner's preference from council policy. |
| US2 / FR-005–FR-008 | Define independently named/coloured/enabled streams and date-anchored weekly cycles supporting daily and multiple weekdays. |
| US3 / FR-009–FR-013 | Include explicit dates and reversible skip/replace/add exceptions; prohibit silent seasonal extrapolation and monthly/four-week conflation. |
| US4 / FR-014–FR-019 | Define existing-calendar presentation, household date semantics, accessible mobile flows, and honest empty/error states. |
| US4 / FR-020–FR-023 | Preserve admin-only mutations, selected public visibility, safe validation, durable configuration, and offline operation. |
| SC-001–SC-008 | Specify measurable setup/readability, calendar correctness, exception isolation, timezone, durability, permission, and offline outcomes. |
| Assumptions / Key Entities | Bound single-household/calendar-only/manual scope as draft defaults, identify dependencies, and defer richer seasonal/monthly rules. |

---

## CH-02 : Confirm existing calendar bin presentation : 2026-Oct-10 1047 UTC+11

**Type**: Revised  
**Summary**: Record the owner's approval of existing Calendar widget integration
and the proposed icon-and-text presentation; prohibit a separate Bin Days widget
without treating unrelated draft defaults as confirmed.

| ID | Description |
| --- | --- |
| US4 scenario 1 / FR-016 | Pair configured-colour bin icons with visible stream names, group by date, emphasise the next collection, and stack narrow-screen rows without hiding names. |
| FR-014 | Explicitly exclude a separate Bin Days widget; retain existing agenda and fullscreen calendar integration. |
| Assumptions | Promote calendar-only/icon-and-text scope to owner-confirmed; keep one-household and manual-entry scope as draft defaults. |

---

## CH-03 : Expand to custom all-day events : 2026-Oct-10 1346 UTC+11

**Type**: Revised / New FR  
**Summary**: Owner approved a Birthdays-style Custom Events manager with title,
icon, colour, one-off/repeating schedules and end dates, keeping bins as a preset.
Supersede the bin-only UI without wiping saved data or changing external feeds.

| ID | Description |
| --- | --- |
| FR-024–FR-025 | Compact dialog/list editor and per-event bundled icons/colour/title. |
| FR-026–FR-027 | Default one-off, bounded N-week recurrence and legacy preservation. |
| FR-028–FR-030 | Additive bin preset, occurrence/series distinction and unchanged safe access/atomicity. |
| Historical US1–US4 / FR-005–FR-017 | Generalise streams to custom events; retain bin scenarios as regression coverage. Selected icons supersede fixed bin icons; new first-date bounds supersede unbounded anchor semantics only for new/bounded events. |
