# Spec Changelog — Mobile Widget Data Management

## Table of Contents

- [CH-01 : Initial mobile data management scope](#ch-01--initial-mobile-data-management-scope)
- [CH-02 : Portable restore recovery](#ch-02--portable-restore-recovery)
- [CH-03 : Final review hardening](#ch-03--final-review-hardening)

---

## CH-01 : Initial mobile data management scope : 2026-Sep-19 0725 AEST

**Type**: New document  
**Summary**: Created the feature specification for mobile widget background
containment, editable Stocks lots, and static ICS birthday-calendar import.

| ID | Description |
| --- | --- |
| FR-001–FR-002 | Shared contained widget surfaces for mobile backgrounds |
| FR-003–FR-007 | Editable Stocks holdings and preserved CSV sync |
| FR-008–FR-013 | Persisted static ICS import and re-import |
| NFR-001–NFR-005 | Mobile, dependency, storage, security, and migration constraints |

---

## CH-02 : Portable restore recovery : 2026-Sep-19 0820 AEST

**Type**: Scope expansion  
**Summary**: Added #216 and #217 after Docker validation proved that portable backups
could not restore into a fresh installation because exported credentials were omitted
without restore-time replacement and dependent rows were inserted before their parent
records.

| ID | Description |
| --- | --- |
| US-4 | Fresh-install portable backup recovery |
| FR-014–FR-016 | Credential exclusion and restoring-admin continuity |
| FR-017 | Foreign-key-safe restore ordering |
| FR-018–FR-020 | Re-authentication state, unavailable assets, and atomic errors |
| NFR-006, SC-005 | Round-trip and supplied-backup Docker validation |

---

## CH-03 : Final review hardening : 2026-Sep-19 0855 AEST

**Type**: Security and reliability clarification  
**Summary**: Expanded portable-backup credential exclusions, made static ICS
replacement atomic, added exact upload-limit coverage, preserved supported Yahoo CSV
date compatibility, ensured uploaded recurring calendars advance through local
scheduled reprocessing, and made production-style Docker upgrade validation a
reusable pre-PR gate.

| ID | Description |
| --- | --- |
| FR-006 | Normalize supported CSV dates and reject invalid lots without losing tickers |
| FR-010–FR-012 | Require VEVENT UIDs, preserve failed re-imports, and locally advance recurring files |
| FR-014, FR-018 | Strip all persisted integration credentials and require reconfiguration |
| NFR-007 | Mandatory candidate-image upgrade validation against a populated `main` database |
