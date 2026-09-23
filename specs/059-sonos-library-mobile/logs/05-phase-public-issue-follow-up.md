# 05 - Public Issue Follow-up

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Investigation](#investigation)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 05 - Public Issue Follow-up
**Task range**: T010-T014
**Date/Time**: 2026-09-23 11:53 AEST
**Purpose**: Fix public issues #8 and #9 without opening a pull request.

## Investigation

- The mobile tab-content wrapper did not establish a column flex layout. Its mobile
  refresh row and a child room list sized to `h-full` therefore exceeded the remaining
  viewport height and clipped the bottom of the room list.
- The separate mobile room/control pill consumed another 44 CSS pixels plus spacing
  above every content tab.
- Automatic widget selection treated the configured default as an active user choice
  and otherwise selected only a playing group or the first topology entry. It had no
  paused or unavailable ranking.
- The screensaver and public widget snapshot implemented separate, narrower selection
  rules.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | `pnpm exec prettier --write <changed files>` | PASS with Node 22 engine warning | [05-phase-public-issue-follow-up/prettier-run-1.log](05-phase-public-issue-follow-up/prettier-run-1.log) |
| 2 | `pnpm rebuild better-sqlite3 argon2` under Node 24.18.0 | PASS | [05-phase-public-issue-follow-up/node24-rebuild-run-1.log](05-phase-public-issue-follow-up/node24-rebuild-run-1.log) |
| 3 | Focused frontend Sonos Vitest suites | PASS - 21 tests | [05-phase-public-issue-follow-up/frontend-vitest-run-1.log](05-phase-public-issue-follow-up/frontend-vitest-run-1.log) |
| 4 | Focused backend selector Vitest suite | PASS - 2 tests | [05-phase-public-issue-follow-up/backend-vitest-run-1.log](05-phase-public-issue-follow-up/backend-vitest-run-1.log) |
| 5 | `pnpm typecheck` | PASS | [05-phase-public-issue-follow-up/typecheck-run-1.log](05-phase-public-issue-follow-up/typecheck-run-1.log) |
| 6 | `pnpm --filter frontend test:unit` | PASS - 115 tests | [05-phase-public-issue-follow-up/frontend-unit-run-1.log](05-phase-public-issue-follow-up/frontend-unit-run-1.log) |
| 7 | `pnpm --filter backend test:unit` | PASS - 216 tests | [05-phase-public-issue-follow-up/backend-unit-run-1.log](05-phase-public-issue-follow-up/backend-unit-run-1.log) |
| 8 | `pnpm typecheck` after paused screensaver coverage | PASS | [05-phase-public-issue-follow-up/typecheck-run-3.log](05-phase-public-issue-follow-up/typecheck-run-3.log) |
| 9 | Focused screensaver Vitest suite | PASS - 2 tests | [05-phase-public-issue-follow-up/screensaver-vitest-run-1.log](05-phase-public-issue-follow-up/screensaver-vitest-run-1.log) |
| 10 | Final `pnpm --filter frontend test:unit` | PASS - 117 tests | [05-phase-public-issue-follow-up/frontend-unit-run-2.log](05-phase-public-issue-follow-up/frontend-unit-run-2.log) |
| 11 | `pnpm build` | PASS | [05-phase-public-issue-follow-up/pnpm-build-run-1.log](05-phase-public-issue-follow-up/pnpm-build-run-1.log) |
| 12 | `pnpm lint` | PASS - zero errors and zero warnings | [05-phase-public-issue-follow-up/eslint-run-1.log](05-phase-public-issue-follow-up/eslint-run-1.log) |

## Review Results

The final code review found no significant correctness, security, state-integrity,
performance, or maintainability issue.

| Before | After | Why |
| --- | --- | --- |
| A separate room/control pill consumed an additional mobile row | Track details toggle secondary controls inside the compact now-playing card | Preserves a 44 px target while returning vertical space to rooms, queue, browse, and favorites |
| The refresh row plus an `h-full` list exceeded the remaining tab height | The tab body owns a column flex layout and each list uses `min-h-0 flex-1` | Keeps every room and content item reachable through intentional internal scrolling |
| All three transport buttons competed with metadata at 360 px | Previous/next remain available by artwork swipe and hide only below 390 px; play/pause stays visible | Protects the focal track information and primary control at the narrowest supported width |
| Screensaver always showed an animated equalizer when Sonos metadata was visible | Playing animates; paused and buffering states use quiet text labels | Motion now reflects actual playback state and does not imply paused audio is active |

## Errors & Fixes

1. The first formatting command inherited Node 22.22.3 and emitted the repository
   engine warning. Dependencies were restored from the configured cache without new
   downloads. Native modules were immediately rebuilt under the pinned Node 24.18.0
   runtime, and every validation command ran under Node 24.18.0.
2. No implementation or test failures were encountered. The frontend suite emitted
   the existing React Router v7 future-flag notices, backend art-cache tests emitted
   their intentional failure-path logs, and Vite retained its existing large-chunk
   advisory; none are lint errors or regressions from this change.

## Phase Checkpoint

Complete. Mobile Sonos content owns the remaining viewport without the refresh-row
overflow, automatic group selection follows playing/buffering -> paused -> stable idle
-> unavailable priority, the screensaver represents paused playback accurately, and
all targeted/full unit, typecheck, build, and lint checks pass under Node 24.18.0.

No pull request was opened. In accordance with the user's request, public issues #8
and #9 remain open until the fix is committed and delivered, and the Main Version was
not advanced.
