# Research — Sonos Phase 2

**Feature**: 029-sonos-phase2
**Date**: 2025-07-25

---

## Table of Contents

- [R-01: UPnP Device Description Parsing](#r-01-upnp-device-description-parsing)
- [R-02: Stereo Pair Detection via Zone Topology](#r-02-stereo-pair-detection-via-zone-topology)
- [R-03: Multi-Account sn= Extraction from Sonos URIs](#r-03-multi-account-sn-extraction-from-sonos-uris)
- [R-04: Browse Panel Service Selector UX Pattern](#r-04-browse-panel-service-selector-ux-pattern)
- [R-05: integration_configs Storage for Account Labels](#r-05-integration_configs-storage-for-account-labels)

---

## R-01: UPnP Device Description Parsing

**Question**: How to extract extended speaker details (modelName, modelNumber, softwareVersion, serialNum, hardwareVersion) from Sonos devices?

**Decision**: Use the existing `node-sonos` library's `deviceDescription()` and `getZoneInfo()` methods — no additional HTTP fetching or XML parsing needed.

**Rationale**: The `sonos.d.ts` type declarations already define `SonosDeviceDescription` (with `modelName`, `modelNumber`, `serialNum`, `softwareVersion`, `hardwareVersion`) and `SonosZoneInfo` (with `SerialNumber`, `SoftwareVersion`, `DisplaySoftwareVersion`, `HardwareVersion`, `IPAddress`, `MACAddress`). The `discoverDevices()` function at `sonos-local-service.ts:57-94` already calls both `deviceDescription()` and `getZoneInfo()` but only extracts `roomName/friendlyName` and `UDN/MACAddress`. Extending the `CachedDevice` interface to store these additional fields is a minimal change.

**Alternatives considered**:
- Direct HTTP fetch of `/xml/device_description.xml`: Rejected — duplicates what `node-sonos` already wraps, adds raw XML parsing dependency.
- New npm package (`fast-xml-parser`): Rejected — no XML parsing needed since `node-sonos` handles it internally.

---

## R-02: Stereo Pair Detection via Zone Topology

**Question**: How to detect stereo-paired speakers and their L/R roles?

**Decision**: Use `getAllGroups()` zone topology data — paired speakers appear as ZoneGroupMembers within the same group where one member has an invisible flag. Cross-reference with `deviceDescription()` channel information.

**Rationale**: The `sonos` library's `getAllGroups()` returns `SonosZoneGroup[]` with `ZoneGroupMember[]`. In a stereo pair, both speakers share a group ID, and the satellite speaker's `Location` XML contains channel mapping info. The coordinator is typically the "left" channel. This approach avoids needing raw SOAP calls or UPnP event subscriptions.

**Alternatives considered**:
- UPnP event subscriptions for topology changes: Rejected — out of scope per spec, adds complexity. Current 30s polling is sufficient.
- Raw SOAP `GetZoneGroupState` call: Rejected — `getAllGroups()` already wraps this and the `SonosZoneMember` type has what we need.

---

## R-03: Multi-Account sn= Extraction from Sonos URIs

**Question**: How does the `sn=` parameter encode multi-account Spotify and can we reliably extract it?

**Decision**: Parse `sn=` from track URIs using the existing regex at `sonos-local-service.ts:328`. Different Spotify accounts connected to the same Sonos system produce different `sn=` values (e.g., `sn=7`, `sn=12`). Store the `sn` alongside the service name in the detection result.

**Rationale**: The current `detectServiceFromUri()` already has a regex `uri.match(/[?&]sid=(\d+)|[?&]sn=(\d+)/)` at line 328 that extracts the `sn` value but only uses it for service name lookup via `SN_MAP`. By returning the raw `sn` value alongside the resolved service name, we can differentiate multiple accounts of the same service. The `sn` value is stable per-account and persists across sessions.

**Alternatives considered**:
- Parse account info from DIDL-Lite metadata XML: Rejected — more complex, `sn` is sufficient for account identification.
- Use Spotify Web API to identify accounts: Rejected — doesn't help with non-Spotify services, and the `sn` approach is service-agnostic.

---

## R-04: Browse Panel Service Selector UX Pattern

**Question**: What's the best UX pattern to replace hardcoded tabs with a dynamic service selector?

**Decision**: Replace the 4 hardcoded tab buttons with a shadcn/ui `Select` dropdown for service selection, plus content-specific sub-tabs within each service's view. The dropdown is compact, scalable to any number of services, and clearly separates "which service" from "what content".

**Rationale**: The current `TAB_CONFIG` at `BrowsePanel.tsx:324-329` mixes service-specific content (Search/Playlists = Spotify) with service-agnostic content (Radio = TuneIn, Library = local). A dropdown naturally groups these as: `Spotify | Sonos Favorites | Radio | Library`, with Spotify expanding to its own Search/Playlists sub-tabs. This matches the shadcn/ui component library already in use and keeps the panel height compact on mobile.

**Alternatives considered**:
- Scrollable horizontal tab bar: Rejected — doesn't scale well, mixes services with content types, breaks on narrow screens.
- Sidebar + content pattern: Rejected — too heavy for a panel that's already inside a modal/drawer.

---

## R-05: integration_configs Storage for Account Labels

**Question**: How to persist `sn=` to friendly-name mappings without a new database migration?

**Decision**: Store as a single JSON value in the existing `integration_configs` table with `provider='sonos'`, `key='account_labels'`. The JSON value is a `Record<string, string>` mapping `"sn:<number>"` → friendly label.

**Rationale**: The `integration_configs` table (with columns `provider, key, value, updatedAt` and `unique(provider, key)`) is already used for per-provider config storage. The `integrationConfigService.ts` provides `getIntegrationConfig()` and `setIntegrationConfig()` which handle upsert via `onConflictDoUpdate`. Storing labels as JSON in a single row avoids needing a new table or migration, keeps the schema stable, and follows the existing pattern used for Spotify client credentials.

**Alternatives considered**:
- New `sonos_account_labels` table with individual rows per sn: Rejected — requires migration, over-engineered for a small key-value set (typically <10 entries).
- Multiple `integration_configs` rows (one per sn): Rejected — works but makes atomic reads/writes harder; a single JSON blob is simpler for the expected cardinality.
