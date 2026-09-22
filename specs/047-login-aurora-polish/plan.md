# Implementation Plan: Login and Aurora Polish

**Branch**: `047-login-aurora-polish` | **Date**: 2026-09-19
**Spec**: [spec.md](./spec.md)

## Summary

Deliver #218 and #122 as a small frontend-only polish pass:

1. Wrap the existing login password input in a relative container and add a labelled
   eye/eye-off button that toggles `type` without changing form behavior.
2. Enhance the existing Aurora CSS classes with isolated pseudo-element curtain layers,
   transform/opacity motion, protected foreground stacking, and reduced-motion rules.
3. Preserve every existing persisted style identifier and API contract.

## Technical Context

- React 18, TypeScript, Tailwind CSS, shadcn input/button conventions, lucide-react
- Existing CSS classes in `index.css` and `header-animations.css`
- Vitest + Testing Library for the login interaction
- No backend, storage, API, dependency, or migration changes

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Secure by default | Password state remains local to the login component; the toggle does not submit, persist, copy, or log it. |
| Mobile-first/accessibility | The toggle is keyboard accessible, state-labelled, focus-visible, and at least 40px wide at 360px. |
| LAN boundary | No network behavior changes. |
| Operational readiness | No new runtime failure mode or configuration. |
| Testing/change safety | Login interaction receives automated coverage; CSS selectors and reduced-motion behavior are reviewed and logged. |
| Data migration | Not applicable; existing style identifiers are unchanged. |

**Result**: PASS.

## Design Decisions

| Decision | Rationale |
| --- | --- |
| Keep the native input and place a button beside it | Preserves browser password-manager behavior and avoids a custom field abstraction. |
| Use `type="button"` and dynamic `aria-label` | Prevents accidental login submission and exposes state to assistive technology. |
| Reuse existing Aurora style values | Avoids schema/API work and upgrades every existing saved selection automatically. |
| Use one multi-gradient pseudo layer per surface | Produces depth without Canvas, JavaScript loops, or additional DOM in every consumer. |
| Animate transform and opacity only | Reduces continuous paint work compared with moving multiple background positions. |
| Freeze layers for reduced motion | Keeps the visual identity without motion. |

## Implementation Phases

| Phase | Scope | Exit criterion |
| --- | --- | --- |
| 01 | Spec and implementation audit | Existing login and Aurora integration points documented |
| 02 | Login visibility control and tests | Toggle behavior and accessibility tests pass |
| 03 | Layered Aurora CSS | Header/widget variants and reduced motion reviewed |
| 04 | Validation and PR | Mandatory tests, reviews, upgrade, and lint gates pass |

## Threat Model

Revealing a password is an explicit local user action. The implementation does not
change authentication transport or storage, does not persist visibility state, and
keeps the existing `current-password` autocomplete contract. Shoulder-surfing remains
an inherent user-controlled risk while the field is revealed.

## Rollback

The change is frontend-only. Reverting restores the previous masked-only input and
single-gradient Aurora rendering without any data conversion.
