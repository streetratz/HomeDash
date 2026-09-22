# 08 — Verification & Documentation

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Baseline Comparison](#baseline-comparison)
- [Threat Model](#threat-model)
- [Design Ship Review](#design-ship-review)
- [Code Review Findings](#code-review-findings)
- [Errors & Fixes](#errors--fixes)
- [Requirement Coverage](#requirement-coverage)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 08 — Verification & Documentation  
**Task range**: T054–T062  
**Date/Time**: 2026-09-18  
**Purpose**: Verify anonymous rendering, revocation, server-side denial,
authenticated behavior, cache safety, and administration UX; document the
behavior change and prepare the branch for review.

All project commands pinned Node `v22.22.3`. Browser tests used an isolated
database at `/tmp/homedash-045-e2e` and Vite at
`PLAYWRIGHT_BASE_URL=http://localhost:5173`.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | Focused public bootstrap, snapshot, cache, and permission tests | ✅ PASS — 65 tests | [security-regression.log](08-phase-verification-docs/security-regression.log), [widget-control-auth.log](08-phase-verification-docs/widget-control-auth.log) |
| 2 | Focused frontend public-mode and visibility tests | ✅ PASS — 5 tests | [frontend-focused.log](08-phase-verification-docs/frontend-focused.log) |
| 3 | `pnpm --filter frontend test:unit` | ✅ PASS — 43 tests | [frontend-unit-full.log](08-phase-verification-docs/frontend-unit-full.log) |
| 4 | `pnpm --filter frontend build` | ✅ PASS | [frontend-build.log](08-phase-verification-docs/frontend-build.log) |
| 5 | `pnpm --filter frontend typecheck` | ✅ PASS | [frontend-typecheck.log](08-phase-verification-docs/frontend-typecheck.log) |
| 6 | `pnpm lint` | ⚠️ BASELINE — 81 problems (54 errors, 27 warnings) | [lint-run-2.log](08-phase-verification-docs/lint-run-2.log) |
| 7 | `pnpm typecheck` | ⚠️ BASELINE — 23 backend-test errors | [typecheck.log](08-phase-verification-docs/typecheck.log) |
| 8 | `pnpm --filter backend test` | ⚠️ BASELINE — 677 pass, 3 known calendar failures | [backend-full-run-2.log](08-phase-verification-docs/backend-full-run-2.log) |
| 9 | `pnpm --filter backend openapi:lint` | ⚠️ BASELINE — 5 errors, 39 warnings | [openapi-lint.log](08-phase-verification-docs/openapi-lint.log) |
| 10 | Targeted Playwright public visibility flow, Chromium and Mobile Safari | ✅ PASS — 2 tests | [public-widget-e2e-final.log](08-phase-verification-docs/public-widget-e2e-final.log) |
| 11 | Full Playwright suite against one persistent development database | ⚠️ NOT A VALID ISOLATED BASELINE — 7 pass, 8 skipped, 31 fail | [e2e-full.log](08-phase-verification-docs/e2e-full.log) |

The cache unit test starts ten simultaneous callers for one widget and asserts
one loader invocation. Together with the two-browser Playwright flow, this
verifies that additional anonymous viewers do not multiply outbound integration
refreshes.

## Baseline Comparison

| Gate | Phase 1 | Final | Result |
| --- | --- | --- | --- |
| ESLint | 81 problems (54 errors, 27 warnings) | 81 problems (54 errors, 27 warnings) | ✅ No new findings |
| TypeScript | 23 backend-test errors | 23 backend-test errors | ✅ No new findings; frontend clean |
| Backend Vitest | 638 pass, 3 known calendar failures | 677 pass, same 3 calendar failures | ✅ 39 tests added/passing |
| OpenAPI lint | 5 errors, 39 warnings | 5 errors, 39 warnings | ✅ No new findings |
| Frontend unit | Not a failing baseline | 43 pass | ✅ |
| Frontend build | Not a failing baseline | Pass | ✅ |
| Feature E2E | Not present | Chromium and Mobile Safari pass | ✅ |

The full Playwright suite is stateful and not independently isolated: earlier
specs mutate the one shared database, causing unrelated later specs to fail.
Mobile Safari also initially could not start because the local WebKit binary was
not installed. After installing WebKit and resetting the exact isolated data
directory, the complete feature flow passed on both configured projects.

## Threat Model

| Threat | Control | Verification |
| --- | --- | --- |
| Hidden/private widget enumeration | Authorization precedes cache lookup and all unavailable widgets return the same 404 body | Public route integration tests |
| Credential or endpoint disclosure | Bootstrap and snapshot payloads are allowlisted; recursive normalized-key scrubbing rejects token/password/secret/credential/api-key variants | Compound-key and nested-secret regression tests |
| Anonymous state mutation | Public namespace is GET-only; existing control routes retain session/admin/CSRF guards; controls are absent from public UI | 56-route permission suite and frontend tests |
| Docker regression / SSRF reopening | Docker is never a public widget type and no authenticated Docker route was weakened | Permission suite and structural type allowlist |
| Polling amplification | Per-widget bounded single-flight cache, stale serving, failure backoff, and per-IP rate limiting | Ten-concurrent-caller cache test |
| Stale access after revocation | Visibility changes invalidate widget snapshots; public JSON sends `Cache-Control: no-store` | Revocation E2E and header assertions |
| Cross-dashboard exposure | Resolver requires membership in the currently selected public web/mobile dashboard | Public visibility integration tests |
| Authenticated users receiving pruned data | Authenticated dashboard loads always use the protected full-dashboard endpoint | Playwright signs in after revocation and confirms the widget remains visible |

## Design Ship Review

`design-taste` and `emil-design-eng` were applied to the administration and
anonymous-rendering surfaces.

| Before | After | Why |
| --- | --- | --- |
| Integration widgets had no understandable anonymous-exposure control | Existing Radix/shadcn Select presents Hidden, Read-only, and Visible with concise consequence copy | Reuses established interaction patterns and keeps the security choice explicit |
| Exposure consequences were easy to miss | Sensitive integration types receive restrained warning treatment; exposed widgets show compact edit-mode indicators | Warning color is reserved for meaningful risk without adding persistent visual noise |
| Public Pi-hole/Sonos views inherited authenticated affordances | Public presentations omit controls, settings, connection links, room pickers, and fullscreen control surfaces | Read-only behavior is visually honest rather than merely disabling actions |
| Auth state could resolve after integration widgets mounted | Widget rendering waits for auth resolution and receives an explicit public-view context | Prevents transient protected requests and error-state flicker |

No new animation, `transition-all`, inappropriate scaling, non-token colors, or
undersized selector targets were introduced.

## Code Review Findings

The complete branch diff was reviewed with `code-review-standard`. Four
high-confidence findings were fixed:

1. **Authenticated dashboard truncation — high.** Authenticated users could
   reuse the already-pruned public bootstrap object when their preferred
   dashboard matched the public default. Authenticated views now always fetch
   the protected full dashboard.
2. **Compound credential keys — high.** Exact-key scrubbing missed forms such
   as `apiToken`, `access_token`, `clientSecret`, and nested `apiKey`. Keys are
   normalized before recursive credential-fragment checks.
3. **Revocation cache semantics — medium.** Public JSON lacked an explicit
   browser/intermediary cache policy. Bootstrap and snapshot responses now send
   `Cache-Control: no-store`.
4. **Blank Pi-hole public view — low.** A controls-only private configuration
   became empty after public controls were removed. Public mode now falls back
   to query statistics.

Regression coverage was added for each security or behavior fix.

## Errors & Fixes

1. **Unknown local admin credentials**: the first Playwright run used an
   existing development database and could not sign in. Browser validation was
   moved to an isolated data directory.
2. **Wrong browser base URL**: Playwright defaults to port 3000, which is the
   API server during development. Runs now set `PLAYWRIGHT_BASE_URL` to Vite on
   port 5173.
3. **Missing WebKit executable**: the Mobile Safari project could not launch.
   `playwright install webkit` restored the configured local browser.
4. **Feature lint delta**: the first final lint run had 11 additional errors
   from generic cache assertions and async test mocks without `await`. The cache
   entry type was simplified and mocks now return resolved promises; lint
   returned exactly to baseline.
5. **Internal source principal assertion**: one new CRUD assertion expected
   `publicSourceUserId` in an admin response, contradicting the contract that
   keeps it service-internal. The assertion now verifies that the field is
   absent.

## Requirement Coverage

- FR-001–FR-004: persisted visibility modes, hidden defaults, and authenticated
  behavior are covered by dashboard integration and frontend state tests.
- FR-005–FR-012: structural authorization, uniform denial, allowlisted
  snapshots, rate limiting, single-flight caching, and unchanged protected
  routes are covered by backend integration/unit tests.
- FR-013–FR-016: public namespace selection and absent controls/configuration
  affordances are covered by frontend unit tests and Playwright request
  inspection.
- FR-017–FR-020: administration controls, exposure warnings, indicators,
  immediate invalidation, and audit records are covered by frontend and backend
  tests.
- FR-021–FR-022: migrations default to hidden, signed-in behavior remains
  available, and the public-dashboard behavior change is documented in README,
  getting-started, operations, and changelog files.
- SC-001–SC-007: automated coverage verifies clean anonymous rendering,
  default-deny exposure, indistinguishable denial, no anonymous mutation,
  secret-free payloads, and preserved authenticated access.

## Phase Checkpoint

✅ Complete. Audit artifacts were committed, the branch was pushed, and
[PR #194](https://github.com/streetratz/HomeDash/pull/194) was opened against
`main` with `Closes #66`, migration notes, the threat model, and the validation
table.
