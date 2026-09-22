# Requirements Checklist — Pi-hole DNS Controls Widget

## Functional Requirements

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-001 | Add Pi-hole widget via widget system | ⬜ Pending | |
| FR-002 | Configure base URL and API token | ⬜ Pending | |
| FR-003 | API token encrypted at rest | ⬜ Pending | Uses token-encryption.ts |
| FR-004 | Backend proxies all Pi-hole API calls | ⬜ Pending | |
| FR-005 | Display DNS stats (queries, blocked, %, domains, clients) | ⬜ Pending | |
| FR-006 | Display blocking status indicator | ⬜ Pending | |
| FR-007 | Disable blocking with durations (5m, 15m, 30m, indefinitely) | ⬜ Pending | |
| FR-008 | Re-enable blocking at any time | ⬜ Pending | |
| FR-009 | Countdown display for timed disable | ⬜ Pending | |
| FR-010 | Auto-refresh at configurable poll interval (30s default) | ⬜ Pending | |
| FR-011 | System health metrics (CPU, memory, load) | ⬜ Pending | |
| FR-012 | Connection test on config save | ⬜ Pending | |
| FR-013 | Clear error states (unreachable, invalid token, unexpected response) | ⬜ Pending | |
| FR-014 | Pi-hole v6+ only, unsupported-version message for v5 | ⬜ Pending | |

## Non-Functional Requirements

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| NFR-001 | Token encrypted server-side, never sent to frontend | ⬜ Pending | |
| NFR-002 | LAN-only, no internet required | ⬜ Pending | |
| NFR-003 | No external data sharing | ⬜ Pending | |
| NFR-004 | Mobile + desktop usable, touch-friendly controls | ⬜ Pending | |
| NFR-005 | Failed API calls logged (token redacted) | ⬜ Pending | |
| NFR-006 | Polling non-blocking, exponential backoff on failure | ⬜ Pending | |
| NFR-007 | Graceful degradation with staleness indicator | ⬜ Pending | |

## Success Criteria

| ID | Criterion | Status | Notes |
|----|-----------|--------|-------|
| SC-001 | Configure + see stats within 60s | ⬜ Pending | |
| SC-002 | Blocking toggle reflected within one poll cycle | ⬜ Pending | |
| SC-003 | All 5 DNS stats match Pi-hole admin | ⬜ Pending | |
| SC-004 | Error state within one poll cycle, auto-recover | ⬜ Pending | |
| SC-005 | Token never exposed in frontend/network/logs | ⬜ Pending | |
| SC-006 | Functional on desktop + mobile | ⬜ Pending | |
