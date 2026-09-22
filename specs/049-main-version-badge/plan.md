# Implementation Plan: Main Version Badge Policy

**Branch**: `049-main-version-badge` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

## Summary

Correct the README Main badge to reflect three existing unreleased PRs plus this policy
PR, and establish a durable per-PR badge rule in `AGENTS.md` and
`RELEASE-LIFECYCLE.md`.

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Security | Documentation-only; no runtime or trust-boundary change. |
| Data integrity | No schema, migration, package, or release-branch changes. |
| Operations | Clarifies ownership between normal PRs and promotion automation. |
| Testing | Markdown-only validation uses `git diff --check`; no app tests required. |

**Result**: PASS.

## Implementation

1. Change only the README Main badge from `v3.1.1` to `v3.1.5`.
2. Add the per-PR increment and rebase rule to `AGENTS.md`.
3. Align `RELEASE-LIFECYCLE.md` and README release documentation.
4. Leave `package.json`, the Release badge, and promotion workflow unchanged.

## Rollback

Revert the documentation commit. No application or deployment state is affected.
