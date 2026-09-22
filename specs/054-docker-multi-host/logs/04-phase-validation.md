# 04 - Validation

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors and Fixes](#errors-and-fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 04 - Validation
**Task range**: T009-T010
**Date/Time**: 2026-09-20 18:50 AEST
**Purpose**: Run final review, tests, lint, build, upgrade, and delivery gates.

## Commands Run

| # | Command group | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | Full backend/frontend tests, typecheck, build, lint, and format check | PARTIAL | [04-phase-validation/full-gates-run-1.log](04-phase-validation/full-gates-run-1.log) |
| 2 | Corrected lint/type assertions; full backend/frontend tests, build, lint, changed-file format, and Docker upgrade | PASS | [04-phase-validation/full-gates-run-2.log](04-phase-validation/full-gates-run-2.log) |

## Code and UI Review

No significant correctness, security, data-integrity, or maintainability findings
remain after reviewing the complete branch diff.

| Before | After | Why |
| --- | --- | --- |
| One implicit Docker connection per widget | Explicit ordered host selection with labelled 44 px reorder controls | Makes the multi-host relationship understandable and usable on touch and keyboard |
| One shared container request | One query and state boundary per host | A slow or failed host no longer suppresses healthy siblings |
| Host actions identified only the widget | Action controls carry the owning connection and accessible host-specific labels | Prevents ambiguous same-name actions and improves screen-reader context |
| Sticky headers used the page background token | Sticky headers use the card surface token | Keeps host sections visually inside the widget instead of exposing the page background |
| New Docker widgets retained an obsolete inline `dockerUrl` default | New widgets store display options only | Keeps the connection model singular and avoids stale configuration |

## Errors and Fixes

1. Full backend execution had two unrelated cross-file interference failures while
   747 tests passed: restore invalidated the Docker auth test session, and birthday
   export received a socket reset. Both are rerun independently before the gate is
   accepted.
2. The new picker tests used asymmetric matchers typed as `any`. The mutation mock is
   now explicitly typed and its call arguments are asserted directly.
3. The new restore assertion now handles an absent backup collection without adding a
   strict indexed-access error. Existing typecheck findings are compared with `main`.
4. Repository-wide Prettier reports a large existing baseline. Changed files are
   checked directly rather than rewriting unrelated files.

## Phase Checkpoint

Complete. The production build, 749 backend tests, 85 frontend tests, zero-warning
lint gate, and real `main`-database Docker upgrade gate pass. The upgrade preserved
28 tables and reported zero foreign-key violations.
