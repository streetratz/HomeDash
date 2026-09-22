# Data Model — Codebase Health Cleanup

This feature does not introduce new persistent entities or database changes. The "entities" below describe the validation model for the SSRF fix and the dependency/file inventories for the cleanup phases.

## Entities

### URLValidationResult

Represents the outcome of validating a URL before the art proxy fetches it.

| Field | Type | Description |
|-------|------|-------------|
| `valid` | `boolean` | Whether the URL passed all checks |
| `reason` | `string \| null` | Rejection reason (null if valid) |
| `resolvedIp` | `string \| null` | The IP address the hostname resolved to |

**Validation rules** (applied in order; first failure short-circuits):

1. **Scheme check**: URL scheme must be `http` or `https`. Reject otherwise.
2. **Hash verification**: `artHash(sourceUrl)` must equal the `:hash` route param.
3. **DNS resolution**: Resolve hostname to IP via `dns.promises.lookup()`.
4. **IP blocklist check**: Reject if resolved IP matches:
   - `127.0.0.0/8` (loopback)
   - `169.254.0.0/16` (link-local, includes cloud metadata `169.254.169.254`)
   - `::1` (IPv6 loopback)
   - `fe80::/10` (IPv6 link-local)
5. **Fetch execution** (in `artCacheService`):
   - **Size limit**: Abort if response body exceeds `5 * 1024 * 1024` bytes (5 MB).
   - **Content-type**: Reject if `Content-Type` header does not start with `image/`.

### DependencyRemovalManifest

| Workspace | Package | Reason |
|-----------|---------|--------|
| frontend | `@fortawesome/fontawesome-svg-core` | Replaced by lucide-react |
| frontend | `@fortawesome/free-solid-svg-icons` | Replaced by lucide-react |
| frontend | `@fortawesome/react-fontawesome` | Replaced by lucide-react |
| frontend | `next-themes` | Unused (zero imports in src/) |
| frontend | `@vitest/coverage-v8` | Unused dev dependency |
| frontend | `@radix-ui/react-tooltip` | No component imports tooltip.tsx |
| backend | `@fastify/csrf-protection` | Unused (zero imports in src/) |
| backend | `@types/sharp` | Incorrect — sharp types are bundled with sharp@0.34+ |

### DeadCodeFileManifest

| File Path | Reason | Safe to Delete |
|-----------|--------|----------------|
| `frontend/src/components/calendar/MiniCalendarView.tsx` | No external imports | ✅ Yes |
| `frontend/src/components/calendar/DayDetailPanel.tsx` | Only imported by MiniCalendarView | ✅ Yes (deleted together) |
| `frontend/src/components/calendar/EventCard.tsx` | Only imported by DayDetailPanel | ✅ Yes (deleted together) |
| `frontend/src/components/ui/progress-bar.tsx` | Zero imports outside itself | ✅ Yes |
| `frontend/src/components/ui/status-dot.tsx` | Zero imports outside itself | ✅ Yes |
| `frontend/src/components/ui/tooltip.tsx` | Zero imports outside itself | ✅ Yes |
| `frontend/src/components/WidgetHeaderContext.tsx` | Used by PlaceholderWidget | ❌ RETAIN |

## State Transitions

### Art Proxy Request Lifecycle

```
[Request Received]
    │
    ▼
[Scheme Check] ──invalid──▶ [400 Bad Request]
    │ valid
    ▼
[Hash Verify] ──mismatch──▶ [403 Forbidden]
    │ match
    ▼
[DNS Resolve] ──blocked IP──▶ [403 Forbidden]
    │ allowed
    ▼
[Fetch Art] ──timeout/error──▶ [502 Bad Gateway]
    │ ok
    ▼
[Size Check] ──exceeds 5MB──▶ [413 Payload Too Large]
    │ ok
    ▼
[Content-Type Check] ──not image/*──▶ [415 Unsupported Media Type]
    │ ok
    ▼
[Return Image + Cache]
```
