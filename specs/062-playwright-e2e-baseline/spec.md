# Feature Specification: Deterministic Playwright E2E Baseline

**Feature Branch**: `062-playwright-e2e-baseline`
**Created**: 2026-09-24
**Status**: In Progress
**Input**: GitHub issue #12

## User Scenario

As a HomeDash maintainer, I can run one documented Playwright command against a clean
local production server and receive deterministic results across the supported desktop
and mobile browser projects.

## Requirements

- **FR-001**: E2E setup MUST use current public bootstrap and authentication routes.
- **FR-002**: Tests MUST tolerate a shared server without depending on file ordering.
- **FR-003**: Desktop and mobile projects MUST run only scenarios valid for their
  configured device and viewport.
- **FR-004**: Setup and cleanup helpers MUST fail with actionable API status details.
- **FR-005**: Stale visual, selector, and responsive expectations MUST match current
  production behavior.
- **FR-006**: The repository MUST document one repeatable local E2E command and server
  lifecycle.
- **FR-007**: Playwright MUST join the pull-request workflow only after the clean
  baseline is stable.

## Success Criteria

- **SC-001**: `pnpm --filter frontend test:e2e` passes from a clean data directory.
- **SC-002**: The suite passes twice consecutively without manual state cleanup.
- **SC-003**: Node 24 typecheck, build, unit tests, lint, and upgrade gates remain green.
