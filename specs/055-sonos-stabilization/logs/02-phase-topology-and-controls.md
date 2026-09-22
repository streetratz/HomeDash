# 02 - Topology and Controls

[<- Back to Logs Index](readme.md)

## Overview

**Phase**: 02 - Topology and controls  
**Task range**: T003-T004, T006  
**Date/Time**: 2026-09-20

## Commands Run

- `pnpm --filter backend exec vitest run tests/unit/sonosDiscovery.test.ts`
- `pnpm --filter backend exec vitest run tests/unit/sonosDiscovery.test.ts tests/integration/widgetDataPermissions.test.ts`
- `pnpm --filter backend build`

## Errors and Fixes

- Replaced test-only copies of stereo filtering with fixtures against the exported production normalizer.
- Prevented coordinator removal, made local grouping return per-player failures, and stopped exposing raw device errors.
- Replaced cloud-mode queue clearing's silent success with an explicit local-mode capability error.

## Phase Checkpoint

Complete. Mixed stereo/manual groups retain every visible room, phantom bonded members are hidden, admin reset preserves the coordinator, partial failures identify affected rooms, and queue clearing is confirmed and local-only.
