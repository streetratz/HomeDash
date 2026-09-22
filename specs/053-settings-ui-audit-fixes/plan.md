# Implementation Plan: Settings UI Audit Fixes

**Branch**: `053-settings-ui-audit-fixes` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Consolidate settings and widget-management interaction patterns without changing
backend contracts. Reuse existing React, Radix/shadcn, TanStack Query, and
dashboard draft-state primitives.

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Security | Clear sensitive form values on every close path; no auth changes. |
| Input validation | Preserve existing API validation and client limits. |
| Data integrity | Guard or retain unsaved drafts; no schema changes. |
| Mobile/accessibility | Label actions, use touch-sized controls, and stack narrow layouts. |
| Testing | Add focused component and state tests plus full pre-PR gates. |
| Scope | Settings and widget management only; Sonos and release are excluded. |

**Result**: PASS.

## Delivery

Use one commit per issue, plus separate workflow/spec bookkeeping commits. Run
the complete gate set immediately before opening the PR. Repeat it only if the
PR branch changes afterward.
