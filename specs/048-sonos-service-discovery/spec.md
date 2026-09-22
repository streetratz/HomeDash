# Feature Specification: Sonos Service Discovery and Browse

**Feature Branch**: `048-sonos-service-discovery`
**Created**: 2026-09-19
**Status**: Implemented
**Input**: GitHub issues #82, #83, and #84

## User Scenarios & Testing

### User Story 1 - See linked and observed Sonos services (Priority: P1)

As an administrator with several music services or multiple accounts for one provider,
I want HomeDash to show the services and account serials the Sonos household exposes so
I can distinguish what content is available without relying on one HomeDash OAuth
account.

**Why this priority**: Service/account discovery is the foundation for the browse
selector and linked-service speaker details.

**Independent Test**: Seed Sonos service descriptors, account XML, favorites, and
currently-playing URIs; verify the API returns a deduplicated safe list with separate
entries for multiple account serials.

**Acceptance Scenarios**:

1. **Given** two observed Spotify account serials, **When** services are requested,
   **Then** both accounts appear as separate entries under Spotify.
2. **Given** firmware returns account metadata, **When** it contains usernames, keys, or
   tokens, **Then** HomeDash returns only service identity, serial number, nickname,
   discovery source, and user-defined label.
3. **Given** firmware suppresses `/status/accounts`, **When** favorites or active tracks
   contain `sid`/`sn` references, **Then** those observed accounts still appear and are
   marked as observed rather than complete household inventory.

---

### User Story 2 - Browse by available service or account (Priority: P1)

As a Sonos user, I want the Browse panel to list services actually available to my
household and show content relevant to the selected service/account instead of fixed
placeholder buttons.

**Why this priority**: The current selector advertises hardcoded services and disables
content that HomeDash can already expose through Sonos Favorites.

**Independent Test**: Provide discovered services and mixed-provider favorites; select
each service/account and verify only applicable search, playlists, radio, library, or
favorite content is shown.

**Acceptance Scenarios**:

1. **Given** Spotify is connected to HomeDash, **When** Spotify is selected, **Then**
   existing Spotify search and playlists remain available.
2. **Given** a non-Spotify service has Sonos Favorites, **When** it is selected, **Then**
   those favorites are browsable and playable.
3. **Given** Radio or the local library is selected, **When** the panel renders, **Then**
   existing radio stations or library navigation remain available.
4. **Given** the current track identifies an available account, **When** Browse opens,
   **Then** that account is selected by default; otherwise the first usable service is
   selected.

---

### User Story 3 - Inspect complete speaker details (Priority: P2)

As an administrator, I want each discovered speaker to show its full model identity,
software, serial, hardware, stereo-pair relationship, and household service context so
I can diagnose my system from HomeDash.

**Why this priority**: Most raw fields already exist, but the settings presentation is
ambiguous and omits linked-service context and the partner speaker name.

**Independent Test**: Render discovery data for standalone and paired speakers and
verify all available fields, pair roles, partner names, and discovered services are
shown without exposing service credentials.

**Acceptance Scenarios**:

1. **Given** a device description includes model name and model number, **When** details
   expand, **Then** both values are labelled distinctly.
2. **Given** a stereo pair, **When** either speaker is shown, **Then** its channel and
   partner speaker name are visible.
3. **Given** household services were discovered, **When** speaker details expand,
   **Then** safe service/account labels are displayed as household-wide context.

### Edge Cases

- No Sonos devices are reachable or discovery times out.
- `ListAvailableServices` works while `/status/accounts` is empty or unavailable.
- Account XML contains deleted entries, malformed fields, duplicate accounts, or
  sensitive credential fields.
- A favorite has a known service but no account serial.
- A service is currently playing but has no favorites or HomeDash-native search.
- The selected service disappears after a topology or account refresh.
- Cloud mode cannot enumerate local account serials and must degrade to favorite-derived
  service names.

## Requirements

### Functional Requirements

- **FR-001**: The backend MUST expose an authenticated, read-only Sonos services endpoint.
- **FR-002**: Local mode MUST query the Sonos MusicServices catalog and map service IDs
  and service types to canonical names.
- **FR-003**: Local mode MUST consume `/status/accounts` when available and MUST ignore
  deleted accounts.
- **FR-004**: Discovery MUST fall back to account references observed in favorites and
  active playback metadata when firmware account inventory is unavailable.
- **FR-005**: The API MUST NOT return or log service usernames, keys, tokens, OAuth
  device IDs, or raw account XML.
- **FR-006**: Each account result MUST identify its provider, Sonos service ID when
  known, account serial when known, safe nickname/label when known, and discovery source.
- **FR-007**: Browse choices MUST be derived from discovered services plus the existing
  local library, Radio, and HomeDash Spotify connection rather than a fixed list.
- **FR-008**: The Browse panel MUST support Spotify search/playlists, local library,
  Radio stations, and service/account-filtered Sonos Favorites.
- **FR-009**: Native third-party SMAPI search and credential extraction are explicitly
  out of scope; unsupported services MUST present favorites-only or an honest empty
  state.
- **FR-010**: Browse defaulting MUST prefer the currently-playing account, then the
  currently-playing service, then the first usable service, then the local library.
- **FR-011**: Speaker details MUST label model name, model number, software version,
  hardware version, serial number, IP address, stereo role, and partner name when known.
- **FR-012**: Speaker details MUST display discovered household services without
  implying that services differ per speaker.
- **FR-013**: Service/account reads MUST tolerate partial Sonos failures and return
  explicit completeness/source metadata instead of success-shaped fabricated accounts.
- **FR-014**: New controls MUST remain keyboard accessible, touch-friendly, and usable
  at approximately 360px width.

### Key Entities

- **SonosService**: Canonical provider identity, Sonos service ID/type, capabilities,
  discovery sources, and zero or more safe account references.
- **SonosServiceAccount**: Provider-scoped account serial, optional Sonos nickname,
  optional administrator label, and observed source.
- **BrowseSource**: A selectable service/account plus its supported content modes
  (`search`, `playlists`, `favorites`, `radio`, or `library`).
- **SpeakerDetails**: Existing discovered speaker fields plus resolved stereo partner
  name and household service context.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Two account serials for the same provider produce two distinguishable
  browse choices and two editable labels.
- **SC-002**: No response or log fixture contains account usernames, keys, tokens, OAuth
  device IDs, or unredacted raw account XML.
- **SC-003**: Browse unit tests cover Spotify, Radio, library, non-Spotify favorites,
  account filtering, and default selection.
- **SC-004**: Discovery tests cover full account XML, empty account XML, favorite
  fallback, active-playback fallback, deleted accounts, and duplicate references.
- **SC-005**: Existing Sonos playback, queue, grouping, and local library tests remain
  green.

## Assumptions

- Sonos account serial numbers (`sn`) are opaque household identifiers and may only be
  discovered after an account is referenced by firmware, a favorite, or active playback.
- `/status/accounts` is firmware-dependent and can legally return an empty support
  document; this is not treated as a complete inventory.
- Linked services are household-wide even though they are surfaced beside speaker
  diagnostics for convenience.
- HomeDash will not store or proxy third-party music-service credentials.
- Existing `sn:<number>` administrator labels remain backward compatible.
