# 02 - Validation

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Review](#review)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 02 - Validation  
**Task range**: T006  
**Date/Time**: 2026-09-20  
**Purpose**: Prove exact promotion, PR version enforcement, formatting, lint, and
upgrade safety before delivery.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | `pnpm test:release-version` | PASS - 8 tests | [02-phase-validation/version-tests-run-1.log](02-phase-validation/version-tests-run-1.log) |
| 2 | `pnpm version:check` and `node scripts/version-state.mjs validate-pr origin/main` | PASS - Main `3.2.6` | [02-phase-validation/version-validation-run-1.log](02-phase-validation/version-validation-run-1.log) |
| 3 | Targeted `prettier --check` and `git diff --check` | PASS | [02-phase-validation/format-run-1.log](02-phase-validation/format-run-1.log) |
| 4 | `pnpm lint` under Node 22 | PASS - zero errors/warnings | [02-phase-validation/eslint-run-1.log](02-phase-validation/eslint-run-1.log) |
| 5 | `pnpm test:upgrade` under Node 22 | PASS | [02-phase-validation/upgrade-run-1.log](02-phase-validation/upgrade-run-1.log) |

## Errors & Fixes

1. The first formatting check found Prettier differences in the new scripts and
   documentation. The files were formatted and the check passed.
2. Initial negative tests expected badge-validation messages before the authoritative
   `versions.json` validation. Assertions were corrected to the actual fail-fast
   behavior.
3. The first implementation assumed `versions.json` existed on the PR base. A legacy
   fallback now derives the base state from `package.json` and README for this migration
   PR; future PRs read `versions.json` directly.
4. Manual dispatch of the PR workflow has no base ref. PR-only version comparison is
   now conditional, while manual dispatch performs repository-state validation.

## Review

- Code review found no unresolved correctness, security, state-integrity, or
  maintainability findings after the workflow bootstrap and concurrency fixes.
- UI review is not applicable because this change has no rendered interface.

## Phase Checkpoint

Complete.

- Exact multi-version promotion is covered.
- Invalid, equal, lower, and inconsistent version states fail closed.
- Main `3.2.6`, Release `3.2.1`, package `3.2.1`, and both badges are consistent.
- Lint gate passed with zero errors and zero warnings.
- Upgrade gate passed with migrations `32 -> 32`, 28 tables preserved, and zero
  foreign-key violations.
