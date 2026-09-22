# Feature Specification: Main Version Badge Policy

**Feature Branch**: `049-main-version-badge`
**Created**: 2026-09-20
**Status**: Implemented
**Input**: Keep the README Main badge distinct from the production Release badge.

## User Story

As a maintainer, I want every merged PR to advance the Main badge so the README shows
that unreleased work exists beyond the production release.

## Requirements

- **FR-001**: Every normal PR MUST increment only `versions.json.main` and the README
  Main Version badge by one patch step.
- **FR-002**: Normal PRs MUST NOT change `package.json` or the Release Version badge.
- **FR-003**: `versions.json` is authoritative. The promotion workflow remains the
  owner of `versions.json.release`, package version, and Release badge, copies the
  exact Main Version into those surfaces, and leaves Main Version unchanged.
- **FR-004**: A branch rebased onto a newer `main` MUST increment from the latest Main
  badge to prevent duplicate development numbers.
- **FR-005**: The current Main badge MUST account for the three PRs merged after
  release `v3.1.1` plus this policy PR, resulting in `v3.1.5` when merged.

## Success Criteria

- README shows Main `v3.1.5` and Release `v3.1.1`.
- Repository guidance tells agents exactly which version surfaces to edit.
- Release lifecycle documentation distinguishes development badge increments from
  production promotion.
