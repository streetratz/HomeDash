# Quickstart — Sonos Library Queue Actions & Sub-Navigation

**Feature**: 042-sonos-library-queue
**Date**: 2026-06-22

## Prerequisites

- Node.js 20+
- pnpm 9+
- A Sonos system on the same LAN (local mode enabled)
- At least one music library share indexed by Sonos

## Development Setup

```bash
# Clone and checkout feature branch
git clone git@github.com:streetratz/HomeDash.git
cd HomeDash
git checkout 042-sonos-library-queue

# Install dependencies
pnpm install

# Start development servers (backend + frontend)
pnpm dev
```

## Verify the Feature

### 1. Browse Library Categories

1. Open HomeDash in browser → navigate to the Sonos controller
2. Select "Library" from the service selector
3. Verify all 6 sub-tabs appear: **Folders**, **Artists**, **Albums**, **Genres**, **Tracks**, **Playlists**
4. Click each sub-tab → content should load from your music library

### 2. Add Container to Queue

1. Navigate to Library → Albums
2. Hover over any album tile
3. Click the play button dropdown (▶ ▾)
4. Select "Add to End"
5. Verify: toast shows "Added N tracks to queue", tracks appear in the Queue panel

### 3. Replace Queue and Play

1. With music playing, navigate to Library → Artists → select an artist → select an album
2. Click the play button dropdown → "Replace Queue"
3. Verify: previous queue is cleared, new album's tracks are loaded, playback starts

### 4. Drill-Down Queue Actions

1. Navigate to Library → Folders → drill into a folder
2. At any nesting level, hover over a subfolder or album
3. Queue actions should be available at every drill-down level

## Running Tests

```bash
# Backend unit + integration tests
cd backend && pnpm test

# Frontend unit tests
cd frontend && pnpm test

# Frontend E2E tests (requires running dev servers)
cd frontend && pnpm test:e2e
```

## Key Configuration

No new environment variables or configuration changes are required for this feature. The existing Sonos local-mode configuration is sufficient.

## API Changes

Two new endpoints added (see `contracts/api-contracts.md` for full details):

- `POST /api/sonos/groups/:groupId/queue/add-container` — batch-add container tracks to queue
- `POST /api/sonos/groups/:groupId/queue/replace` — replace queue with container tracks and play

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Music library requires local mode" | Sonos is in cloud mode | Switch to local mode in Sonos settings |
| Queue actions disabled | No Sonos group selected | Select a group/room from the player selector |
| Empty sub-tab | Library not indexed for that category | Verify music library shares in Sonos app |
| "Failed to add tracks" error | Sonos device unreachable | Check device is on same LAN, restart discovery |
| Large album timeout | Container has 1000+ tracks | Expected — results are capped at 1,000 tracks |
