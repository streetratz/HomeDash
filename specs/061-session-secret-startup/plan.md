# Implementation Plan: Persistent Session Secret Startup

**Branch**: `061-session-secret-startup` | **Date**: 2026-09-24 | **Issue**: #11

## Summary

Replace the production startup failure for missing session-secret variables with an
atomically created random secret stored in the existing persistent data volume. Keep
explicit environment configuration and conflict detection unchanged.

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Security | No known default; 256-bit random secret; file restricted to `0600`. |
| Persistence | Secret lives under `HOMEDASH_DATA_DIR` and survives container replacement. |
| Failure handling | Invalid files fail explicitly; no silent secret rotation. |
| Compatibility | Canonical and legacy variables remain authoritative. |
| Testing | Unit coverage plus local production-container startup and restart verification. |

**Result**: PASS.

## Source Impact

- `backend/src/config/env.ts`
- `backend/tests/unit/env.test.ts`
- `docs/getting-started.md`
- Docker Compose examples

## Threat Model

The secret protects authenticated sessions and encrypted integration credentials from
hostile LAN clients. It is generated with `node:crypto`, stored only in the mounted
data volume, never logged or returned, and restricted to the container user. Anyone
with host-level access to that volume already has equivalent access to the application
database and remains outside the LAN-client threat boundary.
