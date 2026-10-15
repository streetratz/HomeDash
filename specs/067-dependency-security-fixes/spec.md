# Feature Specification: Development Dependency Security Fixes

**Feature Branch**: `067-dependency-security-fixes`
**Created**: 2026-10-16
**Status**: In Progress
**Input**: Dependabot PRs #2 (`@redocly/cli` 1.34.17) and #18 (`undici` 8.10.2)

## User Scenario

As a HomeDash maintainer, I want the lockfile free of known-vulnerable
`undici` and `js-yaml` versions so that dependency review passes and image
scanners stop reporting advisories against packages shipped in the container's
`node_modules`.

## Requirements

- **FR-001**: `@redocly/cli` MUST resolve to 1.34.20 or later within the 1.x line.
- **FR-002**: Every resolved `js-yaml` 4.x MUST be 4.3.2 or later.
- **FR-003**: Every resolved `undici` 6.x MUST be 6.28.1 or later and every 7.x
  MUST be 7.29.1 or later; the backend's direct `undici` 8.10.2 is unchanged.
- **FR-004**: The production dependency tree and runtime behavior MUST NOT change.

## Success Criteria

- **SC-001**: The lockfile contains no `js-yaml` or `undici` version affected by a
  published GitHub advisory as of 2026-10-16.
- **SC-002**: Backend and frontend tests, typecheck, build, lint, E2E, and the
  upgrade gate pass, with any pre-existing failures matched against `main`.
