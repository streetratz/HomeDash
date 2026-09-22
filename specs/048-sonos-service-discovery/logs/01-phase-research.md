# 01 — Research and Contract

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Research Findings](#research-findings)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 01 — Research and contract
**Task range**: T001–T004
**Date/Time**: 2026-09-19 09:41 AEST
**Purpose**: Establish the feasible, secure contract for #82, #83, and #84.

## Commands Run

| # | Command | Outcome | Log File |
| --- | --- | --- | --- |
| 1 | Issue and repository audit | Existing partial implementations identified | [01-phase-research/research-run-1.log](01-phase-research/research-run-1.log) |
| 2 | Pinned `sonos` package inspection | `Services.MusicServices.ListAvailableServices()` confirmed | [01-phase-research/research-run-1.log](01-phase-research/research-run-1.log) |
| 3 | Sanitized LAN capability probe | 94 catalog services; firmware account endpoint empty; favorite account references available | [01-phase-research/research-run-1.log](01-phase-research/research-run-1.log) |

## Research Findings

- `ListAvailableServices` returns the regional service catalog, not linked accounts.
- Older firmware can expose linked accounts at `/status/accounts`; the current LAN probe
  returned an empty `ZPSupportInfo`, so this source must be optional.
- Sonos Favorites on the current household exposed safe `sid`/`sn` references for
  Spotify, Sonos Radio, and YouTube Music.
- Current playback URIs can provide another observed account reference.
- The account document may contain usernames, keys, and OAuth device IDs. These fields
  are unnecessary and must never enter logs or API responses.
- Existing code already retrieves model, model number, software, serial, hardware, and
  stereo pair role. Remaining #84 work is presentation, partner-name resolution, and
  household service context.
- Existing Browse code already has a selector shell but hardcodes Spotify, YouTube
  Music, Radio, and Library; Radio is incorrectly marked non-browsable despite an
  existing stations endpoint.

## Errors & Fixes

1. Repository semantic search returned HTTP 404. Local scoped search and direct source
   reads were used.
2. The first inline TypeScript probe used top-level `await` under CommonJS output and
   failed transformation. Wrapping the probe in an async IIFE fixed execution.
3. The first MusicServices probe passed an empty options object and received a Sonos
   UPnP 500. Calling the parameterless action succeeded.
4. The firmware account endpoint returned an empty support document. The design now
   treats it as one optional source and falls back to favorites and active playback.

## Phase Checkpoint

✅ Complete. The implementation contract is feasible without credential extraction,
native third-party SMAPI authentication, or a schema migration.
