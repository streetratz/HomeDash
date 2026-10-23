# Implementation Plan: Calendar Agenda Today Highlight

**Branch**: `068-calendar-today-highlight` | **Date**: 2026-10-24 | **Issue**: #25

## Summary

Restyle the day groups in `AgendaView` only. Wrap each day's header and timeline
in a `<section>`. Today gets `border-border bg-muted/40 p-3`, matching
`CollectionGroup`'s `next` card, and `aria-current="date"`. Day labels move from
`text-[10px] text-muted-foreground` to `text-xs text-foreground/75`, after a
larger tabular date number. The rail changes from `border-white/10` to
`border-foreground/20`. Dots become 10px solid with a `ring-background` cut-out
instead of a glow. Collection-only days no longer render an empty rail.

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Security | Presentation-only; no endpoint, data, or authorization change. |
| Mobile/accessibility | Light/dark tokens only; `aria-current="date"` added; no fixed widths; no motion. |
| Resilience | No data-flow change; collection and event grouping logic untouched. |
| Performance | Same element count per day (one wrapper added, empty rail removed). |
| Testing | New `agendaView.test.tsx`; existing collection calendar tests unchanged and passing. |

**Result**: PASS.

## Source Impact

- `frontend/src/components/calendar/AgendaView.tsx`
- `frontend/tests/unit/agendaView.test.tsx` (new)
- `CHANGELOG.md`, `versions.json`, `README.md` (Main Version)
