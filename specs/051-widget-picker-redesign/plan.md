# Implementation Plan: Widget Picker Redesign

**Branch**: `051-widget-picker-redesign` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Replace the narrow insertion-order widget grid with a searchable, categorized picker.
The registry gains required category metadata; a pure section builder handles filtering
and deterministic sorting; the dialog becomes a bounded, wider responsive workspace.

## Constitution Check

| Gate | Assessment | Result |
| --- | --- | --- |
| Security | Client-only discovery UI; no auth, API, or trust-boundary changes. | Pass |
| Responsive and accessible | Mobile-first single column, larger desktop cards, semantic sections, labelled search, visible focus, and touch targets. | Pass |
| Local-first | No external service or dependency. | Pass |
| Dependencies | No dependency changes. | Pass |
| Testing and logs | Unit coverage for grouping, sorting, and filtering; frontend tests, build, and lint recorded under `logs/`. | Pass |
| Data and migrations | No persistence or schema changes. | Pass |

## Implementation

1. Add a required category to every widget definition.
2. Build category sections in a fixed order and alphabetize widgets within each section.
3. Add name, description, and category search.
4. Redesign the dialog hierarchy, spacing, width, scrolling, cards, and empty state.
5. Validate with focused tests, the frontend suite, build, and repository lint gate.
