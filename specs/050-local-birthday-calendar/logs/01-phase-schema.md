# 01 — Contract and Schema

## Overview

**Date**: 2026-09-20
**Purpose**: Define the remaining #180 implementation after static ICS import.

## Decisions

- Durable data lives in SQLite, never browser localStorage.
- Birthday rows are normalized instead of hidden inside generated ICS.
- Existing `calendar_events` remains the only widget rendering contract.
- Imports validate completely before append or replace changes persistent rows.
- Export returns generated text through the authenticated API without temporary files.

## Phase Checkpoint

✅ Added generated migration `0030_spicy_tinkerer.sql` with the normalized
`calendar_birthdays` table and `birthday_local` source type.
