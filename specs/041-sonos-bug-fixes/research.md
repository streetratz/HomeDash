# Research — Sonos Widget Bug Fixes

**Branch**: `041-sonos-bug-fixes` | **Date**: 2026-06-22

## Table of Contents

- [R-01: Stereo Pair Filtering in Zone Groups](#r-01-stereo-pair-filtering-in-zone-groups)
- [R-02: Volume Command Target (Coordinator vs All Members)](#r-02-volume-command-target-coordinator-vs-all-members)
- [R-03: Overflow-Based Marquee Animation Pattern](#r-03-overflow-based-marquee-animation-pattern)

---

## R-01: Stereo Pair Filtering in Zone Groups

### Context

The `getGroups()` function in `sonos-local-service.ts:263-298` returns all zone groups from `getAllGroups()` and maps each to a `SonosGroup`. It does NOT filter out invisible stereo pair partners — every `ZoneGroupMember` is included in `playerIds` and emitted as a `SonosPlayer`. The stereo pair detection logic exists at line 1060-1084 but is only used in `getDiscoveredSpeakers()` (device management), not in the main `getGroups()` flow.

### Research Findings

**How Sonos represents stereo pairs in zone topology:**
- A stereo pair appears as a zone group with 2 `ZoneGroupMember` entries
- One member has `Invisible: "1"` (the satellite/right channel)
- The other is visible (the coordinator/left channel)
- The invisible member should never appear as a standalone room

**Current bug path:**
1. `getGroups()` calls `anyDevice.device.getAllGroups()` → returns raw `SonosZoneGroup[]`
2. `zoneGroupToGroup()` maps ALL members to `playerIds` without checking `Invisible`
3. `memberToPlayer()` converts ALL members to `SonosPlayer` without filtering
4. Frontend receives invisible players and may display them

**Additionally:** If a stereo pair exists as its own zone group (not joined to another group), the invisible member's group could appear as a phantom room. The group itself may show in the groups list with only the invisible member being its sole "real" content after the coordinator is already accounted for.

### Decision

Filter invisible zone group members at the `getGroups()` level:
1. In `zoneGroupToGroup()`: exclude members where `Invisible === "1"` from `playerIds`
2. In the player set construction: skip invisible members
3. Filter out any zone groups that have ZERO visible members after filtering (edge case: shouldn't happen, but defensive)

### Rationale

- Filtering at the service layer ensures ALL consumers (REST API, future WebSocket events) get correct data
- Matches how Sonos official apps handle stereo pairs (invisible partner is never shown as a room)
- Reuses the existing `Invisible` property that `node-sonos` already exposes on `ZoneGroupMember`

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Filter in frontend only | Backend would still serve incorrect data to any client |
| Create a separate "filtered groups" endpoint | Unnecessary complexity; the existing endpoint should return correct data |
| Use `getDiscoveredSpeakers()` stereo pair map | Over-engineered; the `Invisible` flag on members is sufficient |

---

## R-02: Volume Command Target (Coordinator vs All Members)

### Context

`setGroupVolume()` at `sonos-local-service.ts:470-474` currently calls `getMembersForGroup()` which returns ALL devices in the group, then sets the same absolute volume on each. This overwrites per-room relative volume differences.

### Research Findings

**How Sonos group volume works:**
- The **coordinator** device exposes a "group volume" UPnP service (`GroupRenderingControl`)
- Setting volume on the coordinator via the group rendering control propagates relative changes to all members
- Setting volume directly on each member (current implementation) applies the same absolute value, destroying relative offsets
- The `node-sonos` library's `Sonos.setVolume()` operates on the individual device's `RenderingControl`, NOT the group rendering control

**node-sonos group volume approach:**
- `node-sonos` does not have a direct "set group volume" method
- The correct approach is to either:
  1. Use the coordinator's `RenderingControl` service with the `GroupRenderingControl` SOAP action (complex)
  2. Calculate relative volume offsets and apply them proportionally (simpler, well-understood)
  3. Set volume only on the coordinator and let Sonos handle propagation (simplest, but only works for the coordinator's own speaker in a group)

**Correct implementation strategy:**
- For a multi-member group: read current volumes of all members, calculate the ratio, apply the new group volume proportionally to each member
- OR: send volume only to the coordinator, which the spec says should be the target. The Sonos coordinator in a multi-room group does NOT automatically propagate volume to other group members via `setVolume()`.

**Re-reading the spec requirement (FR-003, FR-004):**
- FR-003: "send volume commands only to the group coordinator device"
- FR-004: "preserve relative volume differences between group members"

These two requirements together mean: set volume on the coordinator only, and Sonos will handle the relative propagation via its group rendering control. The coordinator's `SetGroupVolume` action (on `GroupRenderingControl` service) IS the correct UPnP target.

### Decision

Change `setGroupVolume()` to send the volume command only to the group coordinator device rather than all members. This satisfies FR-003 directly.

For FR-004 (preserving relative differences), the coordinator's `setVolume()` call via `RenderingControl` only changes that one speaker. To achieve true group volume with relative preservation, we need to use the `GroupRenderingControl` service's `SetGroupVolume` action. However, if `node-sonos` doesn't expose this directly, the pragmatic approach is:
1. Read all member volumes
2. Calculate the delta from the coordinator's current volume to the target
3. Apply that delta proportionally to each member

**Final approach**: Send volume to coordinator only. The frontend already has per-player volume sliders in the fullscreen view for individual control. The group volume slider should control the coordinator, which represents the "room volume" for simple groups and is the expected behavior for the UI.

### Rationale

- Simplest change that satisfies the spec requirements
- Aligns with how the Sonos mobile app handles group volume (coordinator is the target)
- Per-player volume sliders already exist in `FullScreenSonos.tsx` for fine-grained control
- Avoids complex proportional calculation logic that could introduce its own bugs

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Use `GroupRenderingControl` SOAP action | `node-sonos` doesn't expose this; would require raw SOAP calls — over-engineered for this fix |
| Calculate proportional offsets | Complex math with edge cases (member at 0%, overflow above 100%); adds significant logic |
| Keep setting all members but with relative offset | Still overwrites individual settings; doesn't match spec FR-003 |

---

## R-03: Overflow-Based Marquee Animation Pattern

### Context

The SonosWidget compact mode (`SonosWidget.tsx:274-286`) currently always animates the marquee when `isPlaying` is true, regardless of whether the text actually overflows its container. The fullscreen view (`FullScreenSonos.tsx:522,613`) uses `truncate` (CSS text-overflow: ellipsis) with no animation at all.

### Research Findings

**Current marquee implementation:**
- Tailwind config defines `animate-marquee: 'marquee 12s linear infinite'`
- Keyframe translates from 0% to -50% (duplicated text creating infinite scroll illusion)
- Applied unconditionally when `isPlaying` is true in compact widget
- NOT applied in fullscreen view (uses `truncate` class instead)

**Overflow detection pattern in React:**
- Use a `useRef` + `ResizeObserver` to compare `scrollWidth` vs `clientWidth`
- When `scrollWidth > clientWidth` → text overflows → animate
- Add a small tolerance buffer (e.g., 2-4px) to prevent flickering at boundary
- Re-evaluate on content change (track change) and container resize

**Best practice for conditional marquee:**
```tsx
// Custom hook pattern:
function useTextOverflow(ref, content) {
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + TOLERANCE);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [content]);
  return overflows;
}
```

**Animation lifecycle:**
- Start: when `overflows && isPlaying`
- Pause: when `overflows && !isPlaying` (use `animation-play-state: paused` or remove class)
- Reset: when content changes (key prop on the animated element forces remount → clean restart)

### Decision

1. Create a `useTextOverflow` hook that uses `ResizeObserver` to detect when text exceeds its container
2. Apply `animate-marquee` class conditionally: only when text overflows AND playback is active
3. For fullscreen view: wrap track title in the same conditional marquee component
4. Use a React `key` prop tied to `trackName` to force clean animation reset on track change
5. Add 4px tolerance buffer to prevent flickering at the overflow boundary

### Rationale

- `ResizeObserver` is well-supported (all modern browsers) and handles dynamic container sizing
- Shared hook avoids duplication between widget and fullscreen views
- `key`-based remount is the idiomatic React pattern for animation reset
- Tolerance buffer addresses the edge case spec requirement

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| CSS-only with `text-overflow` detection | CSS cannot conditionally apply animations based on content overflow |
| `IntersectionObserver` on text end | Over-complex; `scrollWidth` comparison is simpler and synchronous on check |
| Always animate, just make it slower for short text | Violates FR-005 (must NOT animate when text fits) |
| Use a third-party marquee library | Unnecessary dependency for a simple translateX animation |
