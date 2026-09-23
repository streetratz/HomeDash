# 09 - Release Workflow Chaining

[<- Back to Logs Index](readme.md)

## Overview

**Phase**: 09 - Release Workflow Chaining

**Date/Time**: 2026-09-23 UTC

**Purpose**: Ensure the exact commit validated before owner approval is the only
commit promoted, and publish one Docker image only after the tag and GitHub Release
exist.

## Incident

Creating the initial protected `release` branch triggered the Docker workflow before
promotion. The build correctly failed because the bootstrap commit still represented
Release Version 3.2.7. The first promotion run was cancelled at its owner-approval
gate before any version, branch, tag, release, or package mutation.

The investigation also found that the preflight and promotion jobs independently
checked out the moving `main` branch. A merge during the approval wait could therefore
have promoted a commit different from the one tested by preflight.

## Corrections

- Docker publishing is a reusable `workflow_call` only.
- The publish job depends on completed promotion and runs exactly once.
- Both promotion jobs check out the immutable workflow dispatch SHA.
- Dispatch is accepted only from `refs/heads/main` by the repository owner.
- The promote job fails if remote `main` changed while approval was pending.
- The promoted detached commit is explicitly pushed to both `main` and `release`.
- Docker publishing validates release version mirrors before building.
- A dependency-free Node test enforces the workflow ordering and SHA invariants.

## Validation

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | `pnpm test:release-workflow` | PASS | [09-phase-release-workflow/validation-run-1.log](09-phase-release-workflow/validation-run-1.log) |
| 2 | `pnpm test:release-version` | PASS | [09-phase-release-workflow/validation-run-1.log](09-phase-release-workflow/validation-run-1.log) |
| 3 | `pnpm version:check` | PASS | [09-phase-release-workflow/validation-run-1.log](09-phase-release-workflow/validation-run-1.log) |
| 4 | Node 24 full-repository lint gate | PASS | [09-phase-release-workflow/validation-run-1.log](09-phase-release-workflow/validation-run-1.log) |
| 5 | Main-to-candidate database upgrade gate | PASS | [09-phase-release-workflow/validation-run-1.log](09-phase-release-workflow/validation-run-1.log) |

## Phase Checkpoint

Complete. Release publication now has one ordered trigger and promotes only the exact
commit that passed upgrade preflight before owner approval.
