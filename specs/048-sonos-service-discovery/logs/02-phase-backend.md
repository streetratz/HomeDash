# 02 — Backend Discovery

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 02 — Backend discovery
**Task range**: T005–T009
**Date/Time**: 2026-09-19 09:41 AEST
**Purpose**: Implement and test the safe Sonos service/account discovery contract.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | Focused Sonos backend tests | Parser, aggregation, speaker, and auth tests passed | [02-phase-backend/backend-run-1.log](02-phase-backend/backend-run-1.log) |
| 2 | Backend production typecheck | Passed | [02-phase-backend/backend-run-1.log](02-phase-backend/backend-run-1.log) |
| 3 | Sanitized live LAN discovery | Spotify, Sonos Radio, and YouTube Music accounts discovered from favorites | [02-phase-backend/backend-run-1.log](02-phase-backend/backend-run-1.log) |

## Errors & Fixes

1. The original service detector treated `sn` as a fallback service ID. Account serials
   are provider-scoped account references, so this could misidentify an unknown account
   as SoundCloud or another provider. Detection now uses `sid` only.
2. Firmware and URI observations initially produced duplicate services when catalog
   lookup failed. Synthetic descriptors now derive the service ID from the firmware
   service type so evidence merges on the same stable key.
3. The first full lint run found unsafe stream-reader inference. The response body is
   now explicitly typed as a byte stream while retaining the 256 KiB limit.

## Phase Checkpoint

✅ Complete. The authenticated endpoint returns only linked or observed services,
records provenance and completeness, and discards credential-bearing XML fields.
