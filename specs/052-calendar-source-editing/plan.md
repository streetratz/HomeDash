# Implementation Plan: Calendar Source Editing

**Branch**: `052-calendar-source-editing` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Use the existing calendar source update API to expose birthday-calendar title editing,
then reorganize calendar sources into responsive cards with clearer hierarchy.

## Constitution Check

| Gate | Assessment | Result |
| --- | --- | --- |
| Security | Existing admin, ownership, CSRF, and validation path is reused. | Pass |
| Responsive/accessibility | Stacked mobile cards, touch targets, semantic articles, labelled controls, visible focus from existing primitives. | Pass |
| Data integrity | Rename is a metadata-only update and preserves source/record IDs. | Pass |
| Dependencies | No dependency changes. | Pass |
| Migration | No schema change. | Pass |
| Testing/logging | Component tests plus frontend tests, build, lint, and upgrade gate recorded under `logs/`. | Pass |

## Implementation

1. Add source-title state and save behavior to the birthday manager.
2. Invalidate calendar event queries after source metadata updates.
3. Replace dense source rows with responsive cards and text-labelled actions.
4. Add tests for rename behavior and source-card actions.
