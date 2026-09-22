# Feature Specification: Version, Build Details & About Tab

**Feature Branch**: `028-version-about`  
**Created**: 2026-05-11  
**Status**: Draft  
**Input**: GitHub Issue #80 — "Add Version, Build Details & Public Changelog to Settings/About"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build Info Visibility (Priority: P1)

As a HomeDash user, I want to see the version number, build date, and git commit in the Settings page so I know exactly what version I'm running.

**Acceptance Scenarios**:

1. **Given** I open Settings, **When** I click the "About" tab, **Then** I see the version (e.g. `v2.0.1`), build date, and short commit SHA
2. **Given** I view the commit SHA, **When** I click it, **Then** it opens the GitHub commit page in a new tab
3. **Given** the app is running in development mode, **Then** the environment field shows "development"

### User Story 2 - Server Runtime Info (Priority: P1)

As a HomeDash admin, I want to see server uptime and Node.js version so I can diagnose issues.

**Acceptance Scenarios**:

1. **Given** I open Settings > About, **Then** I see server uptime in human-readable format (e.g. "3d 4h 12m")
2. **Given** I open Settings > About, **Then** I see the Node.js version (e.g. `v20.11.0`)

### User Story 3 - Changelog (Priority: P2)

As a HomeDash user, I want to see recent release notes inline so I know what changed.

**Acceptance Scenarios**:

1. **Given** I open Settings > About, **When** I scroll to the changelog section, **Then** I see the last 5 GitHub releases with version, date, and rendered markdown notes
2. **Given** I want to see older releases, **When** I click "View all releases", **Then** it opens the GitHub Releases page in a new tab

## Functional Requirements

### FR-01: Build-time Injection via Vite `define`

Inject at build time via `vite.config.ts`:
- `__APP_VERSION__` from `package.json` version
- `__BUILD_DATE__` as ISO timestamp
- `__GIT_COMMIT__` as short SHA (from `git rev-parse --short HEAD`)
- `__GIT_REPO__` as `streetratz/HomeDash` (for commit link construction)

### FR-02: Backend System Info Endpoint

`GET /api/system/info` — no auth required (read-only, non-sensitive):
```json
{
  "version": "2.0.1",
  "nodeVersion": "v20.11.0",
  "environment": "production",
  "uptime": 293520,
  "uptimeHuman": "3d 9h 32m"
}
```

### FR-03: About Tab in Settings

New "About" tab in SettingsPage, visible to **all users** (not admin-gated):
- App icon + "HomeDash" heading
- Version, Build Date, Commit SHA (linked), Environment
- Server Uptime (auto-refreshes), Node.js Version
- Divider
- Changelog section (last 5 releases)
- "View all releases on GitHub" link at bottom

### FR-04: Changelog from CHANGELOG.md

A `CHANGELOG.md` file in the repo root follows the [Keep a Changelog](https://keepachangelog.com/) format. At build time, Vite reads it via `fs.readFileSync` and injects it as `__CHANGELOG__` string constant. The About tab renders it inline using a markdown renderer. No runtime API calls, no scripts, no tokens — just a file read at build time.

## Non-Functional Requirements

- Build-time values must survive HMR (Vite dev server)
- System info endpoint should be lightweight (no DB queries)
- Releases bundled at build time — no runtime API calls needed
- About tab should load instantly (all data is build-time or one lightweight API call)

## Out of Scope

- "Update Available" badge (deferred per user decision)
- Auto-update functionality
- CI/CD integration (separate concern)
