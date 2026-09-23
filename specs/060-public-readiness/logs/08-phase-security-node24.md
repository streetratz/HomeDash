# 08 - Security and Node 24 Remediation

[<- Back to Logs Index](readme.md)

## Overview

**Phase**: 08 - Security and Node 24 Remediation

**Date/Time**: 2026-09-23 UTC

**Purpose**: Close public-release security findings, remove high-severity production
dependency advisories, and validate the application and Docker images on Node 24.

## Commands Run

| # | Command or check | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | Production dependency audit | PASS (0 critical, 0 high) | [08-phase-security-node24/audit-run-1.log](08-phase-security-node24/audit-run-1.log) |
| 2 | Backend test suite | PASS (61 files, 777 tests) | [08-phase-security-node24/validation-run-1.log](08-phase-security-node24/validation-run-1.log) |
| 3 | Frontend unit suite and focused redirect tests | PASS | [08-phase-security-node24/validation-run-1.log](08-phase-security-node24/validation-run-1.log) |
| 4 | Workspace typecheck and production build | PASS | [08-phase-security-node24/validation-run-1.log](08-phase-security-node24/validation-run-1.log) |
| 5 | Node 24 full-repository lint gate | PASS | [08-phase-security-node24/validation-run-1.log](08-phase-security-node24/validation-run-1.log) |
| 6 | Main-to-candidate database upgrade gate | PASS | [08-phase-security-node24/validation-run-1.log](08-phase-security-node24/validation-run-1.log) |
| 7 | Alpine and slim production image startup | PASS on Node 24.18.0 | [08-phase-security-node24/validation-run-1.log](08-phase-security-node24/validation-run-1.log) |
| 8 | SQLite, Argon2, and Sharp runtime operations | PASS | [08-phase-security-node24/validation-run-1.log](08-phase-security-node24/validation-run-1.log) |
| 9 | Final code-review standard | PASS (no significant findings) | Recorded below |
| 10 | UI review | Not applicable | No rendered markup, styling, layout, or motion changed |

## Security Outcomes

- Public static serving is restricted to the uploads directory. Database, backup,
  SSH, and cache directories are covered by direct and traversal regression tests.
- Login `returnTo` navigation accepts only normalized same-origin paths and rejects
  absolute, protocol-relative, backslash, malformed, and control-character inputs.
- The vulnerable Sonos `ip` dependency is removed through a reviewed package patch.
- Production audit findings are reduced to two moderate React Router 6 advisories.
  The SSR-only advisory is not reachable because HomeDash is client-rendered, and
  attacker-controlled login navigation is independently normalized and tested.
- Dependency review narrowly allows only those two advisory IDs; all other
  low-or-higher runtime advisories continue to block pull requests.
- Fastify and its plugins are migrated to compatible Fastify 5 releases.

## Runtime Outcomes

Floating `node:24` images resolved to Node 24.21.0 and aborted during Alpine
production startup. Pinning CI, `.nvmrc`, and Docker execution surfaces to the
validated Node 24.18.0 patch restored deterministic startup. Both production
Dockerfiles now build and start successfully, and the slim build compiles native
dependencies in build-only stages without carrying compiler tooling into runtime.

The upgrade gate preserved 28 tables, retained 32 migrations, reported zero foreign
key violations, and verified administrator authentication after candidate startup.

## Known Baseline

The complete Playwright suite still contains unrelated historical failures in theme,
icon, shared login-rate-limit, and timeout behavior. The password-field selectors
affected by the existing visibility control were made exact. Security behavior added
in this phase is covered by passing frontend unit and backend integration tests; this
phase does not claim that the full E2E suite passes.

Repository-wide Prettier remains baseline-red. Each changed file reported by the
targeted check was confirmed to have the same formatting mismatch at the candidate
base, so unrelated formatting was not rewritten.

## Review

The final diff review found no significant correctness, security, data-integrity,
performance, maintainability, test, or documentation defect. The UI review is not
applicable because the frontend production change validates navigation data without
changing rendered interface structure or presentation.

## Phase Checkpoint

Complete. Required unit, integration, type, build, lint, Docker startup, native-module,
dependency-audit, and database-upgrade gates pass. Remaining E2E and formatter
findings are documented pre-existing baselines rather than regressions introduced by
this remediation.
