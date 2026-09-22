# 03 - Validation and Preview

[<- Back to Logs Index](readme.md)

## Overview

**Phase**: 03 - Validation and Preview
**Task range**: T007
**Date/Time**: 2026-09-20
**Purpose**: Verify the candidate build, phone layout, and NAS browsing behavior before
the pre-PR gate.

## Results

| Check | Outcome |
| --- | --- |
| Focused backend regression tests | Passed: 10/10 |
| Focused frontend component tests | Passed: 13/13 |
| Broader backend Sonos suites | Passed: 45/45 |
| Backend and frontend production build | Passed |
| Docker image build | Passed |
| Docker health endpoint | Passed |
| Responsive browser audit | Passed at 360, 390, 412, and 430 px |
| Horizontal document overflow | None at any audited phone width |
| Desktop fullscreen smoke check | No horizontal document overflow |
| Live macOS Sonos discovery | Passed: multiple devices discovered |
| Live NAS library root browse | Passed: one share returned |

## Live Sonos Evidence

The host-network validation discovered multiple speaker classes. The library root
request selected the preferred fixed-speaker class first and returned a sanitized LAN
library share with HTTP 200 in approximately 22 ms.

This confirms the new preference order is active on the actual network and that the
NAS root is no longer converted into a false empty state.

## Docker Preview

- Image: `homedash:059-sonos-preview`
- Container: `homedash-sonos-preview`
- URL: `http://127.0.0.1:3101`
- Data: isolated clone under the session workspace; the repository database is not
  modified.
- Access: bound to localhost only.

Docker Desktop host networking is disabled on this machine, so LAN SSDP validation
was performed with the same backend directly on macOS. The Docker container remains
the interactive UI/build preview.

## Browser Evidence

Responsive screenshots and measurements were stored outside the repository and were
not retained in the public candidate.

The phone screenshots confirm:

- the solid fullscreen background covers the entire viewport;
- primary navigation remains one row;
- library service and category rows scroll instead of wrapping;
- library folders render without document-level horizontal overflow.

## Follow-up Browse Validation

Acceptance testing found that Spotify search failed whenever playlist results were
requested. The live Spotify response contained seven unavailable `null` playlist
entries among twelve results. The backend now ignores unavailable entries instead of
dereferencing them, and the UI now presents explicit search error and no-result states.

Live validation after the fix returned HTTP 200 with:

- 12 tracks;
- 12 albums;
- 5 available playlists.

The dedicated Radio surface remains intentionally backed by Sonos's favorite-radio
stations collection. The current household returns zero entries there, so the empty
state now explains that stations must be saved in the Sonos app.

The discovered provider is named `Sonos Radio`, while four existing Favorites are
tagged by Sonos as `Sonos`. Those names are now treated as aliases so the provider view
can display the existing favorites. This follow-up is tracked in #247.

On September 20, 2026, the Browse services were reordered to put Spotify first and
Library second. The narrower `Radio` surface was renamed `Saved Stations` to distinguish
it from the Sonos Radio provider. Secondary services now follow those primary sources.

The phone layout now promotes the first three sources that are actually available
instead of reserving space for specific providers. With Spotify connected, the order
starts Spotify, Library, then the first discovered provider. Without Spotify, Library
and discovered Sonos providers move forward automatically. Remaining providers and
Saved Stations are placed under `More`.

The Docker and host-network previews were removed after production-image validation.
Private validation data and credentials were not retained in the repository.

## Known Baseline

The repository-wide typecheck still reports pre-existing strictness failures in
backup, restore, and public-widget-cache tests. Source typechecks and the full
production build pass, and none of the baseline failures touch Sonos files.

## Phase Checkpoint

Complete. The candidate is ready for user review. Version advancement and mandatory
pre-PR gates remain intentionally deferred until the PR is about to be opened.
