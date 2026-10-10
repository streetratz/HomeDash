# Specification Constitution Check — Bin Collection Calendar

**Date**: 2026-10-10  
**Authority**: Constitution 2.4.0  
**Scope**: Specification conformity only; not an implementation plan or completed
security, UI, upgrade, or automated-test gate.

| Principle / obligation | Specification evidence | Later implementation evidence required |
| --- | --- | --- |
| I — Secure by default | FR-020–FR-021: admin-only mutation, existing roles, explicit public designation and device-context selection, private-label minimisation, safe validation. US4.4–US4.5 include rejected access. | Default-deny enforcement, positive/negative permission tests, existing session and request-forgery protections, bounded input, public read-only transport, non-enumeration and existing rate limits. |
| II — Mobile-first and accessible | FR-018–FR-019; US4.6–US4.7; SC-005. Names and dates remain readable without relying on colours at 360px. | Critical-flow tests, keyboard/screen-reader checks, light/dark visual review, touch controls, visible focus. |
| III — LAN boundary | FR-023 excludes required internet/cloud, scraping/lookup and notifications; existing calendar integration is a behavioural dependency. | Prove configured local schedules work offline and introduce no exposure or unsolicited callback. |
| IV — Operational readiness | FR-019, FR-021–FR-022 require honest errors, safe failed edits, restart/upgrade recovery. | Diagnostic logs without private labels/secrets, deliberate errors, lifecycle and operational documentation; retain existing health behaviour. |
| V — Testing and change safety | Four independently testable stories; date/exception cases; SC-001–SC-008; FR-022 preserves existing data. | Recurrence/date tests across DST/leap/year boundaries, critical-flow tests, positive/negative auth tests, backup/restore and migration/upgrade checks. |
| Phase audit | Canonical [logs index](logs/readme.md), numbered [spec phase](logs/01-phase-specification.md), raw sidecars. | New per-phase logs at future phase start; retain all audit artifacts with the feature. |
| Spec changelog | [CH-01](changelog-spec.md) created with the initial completed specification. | Every subsequent spec edit gets its own contemporaneous CH entry; commit spec and changelog together when authorised. |
| Feature workflow | Template-derived spec; branch hook created `065-bin-collection-calendar` from verified clean main; independent spec directory scan selected 065. | A template-derived plan with its own Constitution Check only when requested; no constitution exception is claimed. |
| Release lifecycle | This session does not open a PR, change app code/version, push, or commit. | Normal Main Version patch increment and all applicable PR gates before a future PR; no release-owned surfaces changed in a normal feature PR. |

## Brief Threat Model

- **Exposed content**: Only selected collection names, colours, household dates,
  and necessary date-display context may be visible on an explicitly public
  Calendar widget. Anchors, exceptions, provider labels, management, identity,
  and unrelated private events remain private.
- **Potential actors**: Anonymous or compromised LAN visitors, signed-in non-admin
  residents, and authorised administrators.
- **Risks**: Unauthorised schedule edits, disclosure of household/provider
  configuration, reading unselected streams through calendar selection, invalid
  dates/collisions causing misleading guidance, and coupling one stream's edit
  to another.
- **Mitigations required by the spec**: Default-deny existing permissions and
  visibility selection, no public mutations, independent stream identity, validated
  date editing, explicit preview/conflict handling, private-label exclusion, and
  no required external service/address submission.

## Scope Review

## Implemented threat mitigations (local candidate)

This implementation evidence supplements, rather than retroactively changes,
the specification-only review above. The LAN is not trusted.

| Threat | Implemented mitigation | Actual evidence |
| --- | --- | --- |
| Guessed IDs, wrong/forged dashboard or device context | Real designated dashboard/widget lookup; saved public subset intersection; arbitrary query streams rejected; allowlisted DTO only | `backend/tests/integration/collectionPublic.test.ts` |
| Resident/generic-manage admin bypass, expired or absent session, request forgery | Default-deny administrator middleware before parsing; supported session authentication and CSRF; no public mutations | `backend/tests/contract/collections.test.ts` |
| Private rule/provider disclosure or restore failure leaks | Display excludes rules/providerLabel/revision/epoch; restore sanitizes errors before logger; backup secret exclusions unchanged | `collectionPublic.test.ts`, `collectionBackup.test.ts` |
| Public cached data after revocation/logout | Context/account/widget/window query separation; denied active payload cleared; visibility/resume refresh and bounded foreground polling | `frontend/tests/unit/collectionHooks.test.tsx` |
| Oversized/hostile payload and misleading dates | Strict schemas, 2 MiB body and explicit count/date/range bounds; full aggregate collision/orphan validation including disabled/out-of-range exceptions | `collections.test.ts`, `collectionExceptions.test.ts`, `collectionDates.test.ts` |
| Concurrent save/restore and partial mutation | Revision + process epoch + preview digest; transaction; stable-ID exception destination swaps; destructive confirmations | `backend/tests/unit/collectionService.test.ts`, `collectionBackup.test.ts` |
| Existing provider/birthday/widget data loss | Additive generated migration, independent authoritative rows, backup equality, repeated migrations and FK checks | `collectionMigration.test.ts`, `migrationIntegrity.test.ts`, `collectionPreset.test.ts` |

The focused acceptance suite and both browser engines run against disposable
data. This is not a claim of penetration testing, ten-person usability evidence
or manual assistive-technology verification. Full Docker upgrade evidence is
recorded separately in the final phase audit, including any environment blocker.

## Historical specification scope

No stack, route, storage schema, source type, or event-generation architecture is
chosen. Existing calendar code was read for context only. Reuse is to be assessed
during planning, particularly per-stream colours and household timezone semantics;
the current calendar's general date helpers are not assumed sufficient unchanged.

The checklist is ready for a planning handoff, not proof that tests or user studies
have run. Single-household/calendar-only/manual-entry boundaries are documented
draft defaults rather than invented owner approvals. No mandatory clarification
is outstanding for this bounded draft.
