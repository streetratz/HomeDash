# Specification Changelog

## Table of Contents

- [CH-01 - 2026-09-20](#ch-01---2026-09-20)
- [CH-02 - 2026-09-20](#ch-02---2026-09-20)
- [CH-03 - 2026-09-23](#ch-03---2026-09-23)

## CH-01 - 2026-09-20

- Created the specification from #244 and #245.
- Defined bounded fallback across discovered speakers and an explicit upstream error
  state for failed ContentDirectory reads.
- Defined shared CIFS/ObjectID normalization requirements.
- Limited the visual redesign to phone fullscreen and nested browse navigation.

## CH-02 - 2026-09-20

- Added the user-requested ContentDirectory preference for stable soundbars and fixed
  speakers ahead of portable Roam/Move devices.
- Kept all discovered speakers in the fallback sequence so mixed Sonos systems remain
  compatible.

## CH-03 - 2026-09-23

- Retargeted the feature to public issues #8 and #9 after the public repository
  cutover.
- Added a shared automatic group-selection policy for widget, fullscreen, public
  snapshot, and screensaver surfaces.
- Clarified that configured defaults only break ties while explicit in-session room
  selections remain authoritative.
- Added the mobile internal-height requirement revealed by the migrated clipping
  report.
