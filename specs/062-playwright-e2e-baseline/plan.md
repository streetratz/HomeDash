# Implementation Plan: Deterministic Playwright E2E Baseline

**Branch**: `062-playwright-e2e-baseline` | **Date**: 2026-09-24 | **Issue**: #12

## Summary

Repair the E2E harness before individual assertions: centralize current admin/session
setup, make project coverage intentional, then update stale selectors and expectations.
Run the suite repeatedly against a clean production server before enabling it in CI.

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Security | Tests use existing auth/CSRF flows and only fixed local credentials. |
| Mobile/accessibility | Retain explicit phone coverage while removing accidental duplicate runs. |
| Resilience | Setup failures include route/status details instead of cascading timeouts. |
| Testing | The feature directly restores the critical-flow E2E gate. |

**Result**: PASS.

## Initial Failure Groups

1. Five specs call obsolete `/api/bootstrap` and parse the SPA HTML fallback as JSON.
2. Desktop-oriented specs are duplicated under the iPhone project without intentional
   mobile assertions.
3. Stale CSS and strict-locator expectations fail immediately.
4. Shared setup/cleanup helpers duplicate auth logic and consume the remaining test
   timeout after earlier assertions fail.
5. Responsive and widget tests contain current-behavior mismatches that require focused
   reruns after the harness failures are removed.

## Source Impact

- `frontend/playwright.config.ts`
- `frontend/tests/e2e/`
- `.github/workflows/pull-request.yml` after the baseline is stable
- `docs/getting-started.md`
