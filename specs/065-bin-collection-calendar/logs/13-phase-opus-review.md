# 13 — Fresh-Context Opus Review

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Review and Resolution](#review-and-resolution)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 13 — Independent review and scoped correction  
**Date**: 2026-10-10  
**Task range**: T064 review refinement; broader pending matrices remain pending  
**Purpose**: Review candidate fbd8ad2 with a fresh claude-opus-4.8 context as
requested, without a PR or push.

## Review and Resolution

The independent reviewer found no Critical or High defect and considered the
candidate acceptable for local owner validation. One Medium finding identified
the fullscreen today highlight using browser date rather than household date.
The reviewer also proposed changing provider-today navigation to household date.

The latter suggestion conflicts with the intentional UI contract's separate
provider/browser and household controls. Preserve that distinction rather than
silently changing provider semantics: use the household date for the primary
highlight in collection mode, label the browser control explicitly, and mark
browser today separately when dates differ. Legacy calendars retain their
browser-today behaviour. Recompute browser date on render instead of a once-only
memo and navigate consistently to that date.

Add a focused regression with differing dates, both controls, and a subsequent
date-context update. Do not claim this completes T066/T067's broader matrices.
Optional provider over-fetch and empty timeline cosmetics remain out of scope.

| Before | After | Why |
| --- | --- | --- |
| Browser date receives the primary today fill | Household date receives the primary fill; differing browser date has a quiet outline | Collection dates follow the household timezone without obscuring browser context |
| Provider Today control | Browser Today (provider events) control | Explicitly distinguish browser-date navigation from Household Today |

Existing theme tokens, touch targets, and interaction styles are retained. No
new motion or widget is introduced. The component was formatted by the owning
formatter alongside the correction.

## Commands Run

- Targeted collection calendar tests: 8 passed.
- Full frontend unit suite: 43 files, 174 tests passed.
- Both package typechecks and production builds passed.
- Full Node 24 `pnpm lint`: zero errors and warnings.
- `git diff --check`: passed.

Raw evidence: [targeted tests](13-phase-opus-review/frontend-vitest-run-1.log)
and [frontend suite, typechecks, builds, lint](13-phase-opus-review/frontend-checks-run-1.log).

## Errors & Fixes

Medium UI inconsistency corrected as described above; no application data
changes. Build emitted its existing large-chunk advisory, not a build failure.

## Phase Checkpoint

Scoped correction validated. Task checkboxes remain 78/97: this regression does
not constitute the outstanding comprehensive matrices or human validation.
No PR, push, or merge.
