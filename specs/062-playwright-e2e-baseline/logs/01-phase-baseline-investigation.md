# 01 - Baseline Investigation

[<- Back to Logs Index](readme.md)

## Table of Contents

- [Overview](#overview)
- [Commands Run](#commands-run)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview

**Phase**: 01 - Baseline Investigation
**Task range**: T001-T004
**Date/Time**: 2026-09-24
**Purpose**: Remove harness-level failures before repairing focused E2E assertions.

## Commands Run

Initial evidence is retained in
`specs/061-session-secret-startup/logs/01-phase-session-secret-startup/playwright-run-2.log`.

## Errors & Fixes

1. The baseline has five obsolete `/api/bootstrap` callers that receive the production
   SPA fallback and throw while parsing HTML as JSON.
2. The same desktop-heavy suite runs under both Chromium and an iPhone project,
   duplicating stateful tests without intentional mobile coverage.

## Phase Checkpoint

Complete. The baseline established 41 failures, 13 passes, and 4 skips. The
dominant failure source was repeated login exhausting the production
rate-limit; secondary groups were obsolete API routes, duplicated mobile
coverage, and stale UI assertions.
