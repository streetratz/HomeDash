# Data Model — Performance Optimizations & Pi-hole Widget Polish

**Feature Branch**: `040-perf-and-polish`  
**Date**: 2026-06-22

## Overview

This feature introduces no new persistent entities or database changes. All modifications are frontend-only, affecting in-memory state and configuration passed to TanStack Query hooks. This document describes the key data structures and state transitions relevant to the implementation.

---

## Entities

### 1. PollingConfiguration

**Purpose**: Represents the runtime polling parameters for a widget's TanStack Query hook.

| Field | Type | Description |
|-------|------|-------------|
| `staleTime` | `number` (ms) | Duration after fetch before data is considered stale |
| `refetchInterval` | `number \| false` | Interval between automatic refetches; `false` disables polling |
| `userOverride` | `number \| undefined` | User-configured interval (from widget settings); takes precedence if set |

**Default values by widget**:

| Widget | staleTime | refetchInterval (default) | Notes |
|--------|-----------|--------------------------|-------|
| Pi-hole | 30,000ms | 60,000ms | Was 30s/30s; now 30s stale, 60s refetch |
| UniFi | 30,000ms | 60,000ms | Was 30s/30s; now 30s stale, 60s refetch |
| Spotify (playing) | 3,000ms | 5,000ms | Unchanged |
| Spotify (paused) | 15,000ms | 30,000ms | New: slower poll when paused |
| Spotify (hidden) | ∞ | `false` | New: no polling when not visible |

**Validation rules**:
- `staleTime` must be < `refetchInterval` (stale before next fetch)
- `refetchInterval` must be ≥ 1000ms (prevent accidental sub-second polling)
- If `userOverride` is set and ≥ 1000ms, it replaces `refetchInterval`

---

### 2. WidgetVisibilityState

**Purpose**: Tracks whether a widget should be actively polling based on tab and viewport visibility.

| Field | Type | Description |
|-------|------|-------------|
| `isTabVisible` | `boolean` | `true` when `document.visibilityState === 'visible'` |
| `isInViewport` | `boolean` | `true` when IntersectionObserver reports `isIntersecting` |
| `isActive` | `boolean` (derived) | `isTabVisible && isInViewport` |

**State transitions**:

```
┌─────────────────────────────────────────────────┐
│           WidgetVisibilityState                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  Tab Hidden ──────────► isActive = false         │
│       │                     │                    │
│  Tab Visible                │                    │
│       │                     ▼                    │
│       ▼              Check Viewport              │
│  isTabVisible=true          │                    │
│       │            ┌────────┴────────┐           │
│       ▼            ▼                 ▼           │
│  In Viewport    Out of Viewport                  │
│  isActive=true  isActive=false                   │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Events that trigger transitions**:
- `document.visibilitychange` → updates `isTabVisible`
- `IntersectionObserver` callback → updates `isInViewport`
- On regaining visibility (`isActive` false→true): immediate refetch triggered

---

### 3. SpotifyPlaybackState (existing, extended usage)

**Purpose**: The existing `NowPlaying.isPlaying` field determines the Spotify polling rate.

| Field | Type | Description |
|-------|------|-------------|
| `isPlaying` | `boolean` | Whether Spotify playback is active |

**Polling rate decision matrix**:

| isActive (visibility) | isPlaying | refetchInterval |
|----------------------|-----------|-----------------|
| `true` | `true` | 5,000ms |
| `true` | `false` | 30,000ms |
| `false` | any | `false` (disabled) |

---

### 4. RouteChunk (conceptual)

**Purpose**: Represents a lazily-loaded page bundle.

| Field | Type | Description |
|-------|------|-------------|
| `routePath` | `string` | URL path that triggers the chunk load |
| `componentModule` | `string` | Import path (e.g., `'../pages/DashboardPage.js'`) |
| `status` | `'idle' \| 'loading' \| 'loaded' \| 'error'` | Current load state |

**Route-to-chunk mapping**:

| Route | Chunk | Component |
|-------|-------|-----------|
| `/` | `DashboardPage-[hash].js` | `DashboardPage` |
| `/settings` | `SettingsPage-[hash].js` | `SettingsPage` |
| `/first-run` | `FirstRunPage-[hash].js` | `FirstRunPage` |
| `/login` | `LoginPage-[hash].js` | `LoginPage` |

---

### 5. PiholeWidgetLayoutMode

**Purpose**: Determines the Pi-hole widget's visual layout based on container size.

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `'compact' \| 'standard'` | Layout mode based on cell width |
| `cellWidth` | `number` (px) | Grid cell width provided by react-grid-layout |

**Threshold**: `compact` when `cellWidth ≤ 200px`; `standard` otherwise.

**Compact mode changes**:
- Single-column stacked panels (controls → system → queries)
- Reduced padding: `p-1.5` (from `p-2`)
- Smaller icons: `h-3 w-3` (from `h-3.5 w-3.5`)
- Text truncation on all stat values
- Section headers hidden to save vertical space
- Controls panel: smaller logo (`h-14 w-14`), inline status+button

---

## Relationships

```
┌──────────────────┐     uses      ┌─────────────────────────┐
│ SpotifyWidget    │──────────────►│ WidgetVisibilityState    │
│                  │               │ (useWidgetVisibility)    │
└──────────────────┘               └─────────────────────────┘
        │                                    │
        │ uses                               │ determines
        ▼                                    ▼
┌──────────────────┐            ┌─────────────────────────┐
│ useNowPlaying    │◄───────────│ PollingConfiguration     │
│ (TanStack Query) │            │ (refetchInterval)        │
└──────────────────┘            └─────────────────────────┘

┌──────────────────┐     uses      ┌─────────────────────────┐
│ PiholeWidget     │──────────────►│ PiholeWidgetLayoutMode   │
│                  │               │ (compact/standard)       │
└──────────────────┘               └─────────────────────────┘
        │
        │ uses
        ▼
┌──────────────────┐
│ usePiholeStats   │  ← staleTime: 30s, refetchInterval: 60s
└──────────────────┘
```
