# Research — Codebase Health Cleanup

## Table of Contents
- [R-01: SSRF Protection for Art Proxy](#r-01-ssrf-protection-for-art-proxy)
- [R-02: Sonos LAN Art URL Behavior](#r-02-sonos-lan-art-url-behavior)
- [R-03: Undici vs Global Fetch Type Resolution](#r-03-undici-vs-global-fetch-type-resolution)
- [R-04: FontAwesome to Lucide Migration](#r-04-fontawesome-to-lucide-migration)
- [R-05: WidgetHeaderContext Retention Decision](#r-05-widgetheadercontext-retention-decision)
- [R-06: Tooltip Component Retention Decision](#r-06-tooltip-component-retention-decision)

---

## R-01: SSRF Protection for Art Proxy

**Context**: The `/api/sonos/art/:hash` endpoint fetches arbitrary URLs via `artCacheService.getArt()`. The `:hash` param is present but never verified against the `src` query param. No IP blocking, scheme validation, size limit, or content-type check exists.

**Decision**: Implement a dedicated `url-validator.ts` utility in `backend/src/lib/` that provides:
1. **Hash verification** — compare `artHash(sourceUrl)` against the `:hash` route param before fetching.
2. **Scheme whitelist** — reject anything not `http://` or `https://`.
3. **DNS resolution + IP blocking** — resolve hostname via `dns.promises.lookup()`, reject if resolved IP falls in:
   - `127.0.0.0/8` (loopback)
   - `10.0.0.0/8` (RFC 1918)
   - `172.16.0.0/12` (RFC 1918)
   - `192.168.0.0/16` (RFC 1918)
   - `169.254.0.0/16` (link-local / cloud metadata)
   - `::1`, `fc00::/7`, `fe80::/10` (IPv6 equivalents)
   - **Exception**: Allow private IPs that are Sonos device addresses (see R-02).
4. **Response size limit** — abort after 5 MB streamed.
5. **Content-type validation** — only allow `image/*` content-types.

**Rationale**: Centralised in a utility for unit-testability. The art proxy route calls validation before delegating to `getArt()`. The `artCacheService` itself gets size + content-type checks as defense-in-depth.

**Alternatives considered**:
- Middleware-level URL allowlist → too restrictive; Sonos art URLs are dynamic.
- Proxy through a separate service → over-engineered for a dashboard.

**Threat model note** (constitution requirement):
- **Exposed**: Outbound fetch from backend to arbitrary URLs.
- **Who can access**: Any authenticated user can trigger via crafted `src` param.
- **Mitigation**: Hash verification (prevents URL tampering), IP blocking (prevents SSRF to internal infra), size/type limits (prevents resource exhaustion).

---

## R-02: Sonos LAN Art URL Behavior

**Context**: Sonos devices serve album art via HTTP on the LAN (e.g., `http://192.168.1.x:1400/getaa?...`). The SSRF IP blocklist would block these legitimate requests.

**Decision**: Allow private-range IPs for the art proxy **only** because:
1. The endpoint requires authentication (only logged-in users can trigger fetches).
2. The art proxy already exists to serve Sonos art from LAN devices.
3. The hash verification ensures the URL was generated server-side (not user-crafted).

**Implementation**: The IP blocklist will block `169.254.169.254` (cloud metadata) and `127.0.0.0/8` (loopback) unconditionally. RFC 1918 ranges (`10.x`, `172.16-31.x`, `192.168.x`) will be **allowed** for the art proxy since HomeDash is LAN-only and Sonos devices live on these ranges.

**Rationale**: Blocking RFC 1918 would break core functionality. The hash verification + auth requirement provide sufficient protection against arbitrary SSRF. The real threat (cloud metadata endpoint `169.254.169.254`) is still blocked.

**Alternatives considered**:
- Explicit Sonos IP allowlist from config → too brittle; Sonos IPs change via DHCP.
- Block all private and require Sonos art to be fetched differently → breaks existing architecture.

---

## R-03: Undici vs Global Fetch Type Resolution

**Context**: `backend/src/services/unifi-service.ts` imports `fetch as undiFetch` from `undici` and its wrapper functions declare return type `Promise<Response>`. The `Response` here refers to the **global** `Response` type (from `lib.dom` or Node 22's globals), but undici's `fetch` returns `undici.Response` which is structurally similar but nominally distinct. This causes `tsc --noEmit` errors.

**Decision**: Use `import type { Response as UndiciResponse } from 'undici'` and type the wrapper return values explicitly as `Promise<UndiciResponse>`. This is the minimal-diff fix.

**Rationale**:
- Node 22 has global `fetch`, but the UniFi service specifically needs undici's `Agent` for custom TLS settings (self-signed certs on UniFi controllers). Switching to global fetch would lose the `dispatcher` option.
- Explicitly typing with `UndiciResponse` makes the contract clear and eliminates the nominal type mismatch.

**Alternatives considered**:
- Switch to Node 22 global `fetch` → Cannot pass custom `Agent`/`dispatcher` for TLS bypass.
- Use `as unknown as Response` casts → Hides real type mismatches; unsafe.
- Add `skipLibCheck: true` → Masks all type errors; unacceptable.

---

## R-04: FontAwesome to Lucide Migration

**Context**: `ClockStrip.tsx` imports `faHouse`, `faSun`, `faMoon` from `@fortawesome/free-solid-svg-icons` and renders them via `<FontAwesomeIcon>`. The project already has `lucide-react@1.11.0` installed.

**Decision**: Replace with lucide-react `<Home>`, `<Sun>`, `<Moon>` components.

**Mapping**:
| FontAwesome | Lucide-React | Notes |
|-------------|--------------|-------|
| `faHouse` → `<FontAwesomeIcon icon={faHouse}>` | `<Home size={...} />` | Same semantic |
| `faSun` → `<FontAwesomeIcon icon={faSun}>` | `<Sun size={...} />` | Same semantic |
| `faMoon` → `<FontAwesomeIcon icon={faMoon}>` | `<Moon size={...} />` | Same semantic |

**Rationale**: lucide-react is already a dependency, tree-shakes well, and is the standard icon library for the project. FontAwesome adds 3 packages (~800KB unpacked) for 3 icons.

**Alternatives considered**:
- Keep FontAwesome for just these 3 icons → Bloat for minimal use.
- Inline SVGs → Less maintainable than a library.

---

## R-05: WidgetHeaderContext Retention Decision

**Context**: `WidgetHeaderContext.tsx` exports `WidgetHeaderProvider` and `useWidgetHeaderCollector` which are actively used by `PlaceholderWidget.tsx` (imported in `DashboardGrid.tsx`).

**Decision**: **RETAIN** — `WidgetHeaderContext.tsx` is actively used. It is NOT dead code.

**Evidence**:
- `PlaceholderWidget.tsx:14` imports `{ WidgetHeaderProvider, useWidgetHeaderCollector }` from it.
- `PlaceholderWidget.tsx` uses both at lines 112, 136, 198, 215.
- `DashboardGrid.tsx` renders `<PlaceholderWidget>`.

---

## R-06: Tooltip Component Retention Decision

**Context**: `frontend/src/components/ui/tooltip.tsx` wraps `@radix-ui/react-tooltip`. The spec lists both the component file and the `@radix-ui/react-tooltip` dependency as removal targets.

**Decision**: **RETAIN** both `tooltip.tsx` and `@radix-ui/react-tooltip`. Although no current component imports `tooltip.tsx` directly, this is a shadcn/ui pattern component that may be used in the future and the Radix tooltip is lightweight (~15KB). However, since the spec explicitly lists `@radix-ui/react-tooltip` for removal AND no component currently imports `tooltip.tsx`:

**Revised decision**: **DELETE** `tooltip.tsx` and remove `@radix-ui/react-tooltip` from `package.json` per spec. No current consumer exists — verified via grep (zero results outside the file itself).

---

## Summary of Clarifications Resolved

| Item | Resolution |
|------|-----------|
| Sonos LAN art URLs blocked by SSRF? | No — allow RFC 1918; block only loopback + link-local/metadata |
| Undici vs global fetch? | Keep undici (needs custom Agent); explicitly type as `UndiciResponse` |
| WidgetHeaderContext dead? | No — actively used by PlaceholderWidget; RETAIN |
| Tooltip component dead? | Yes — no consumers; DELETE with its Radix dependency |
