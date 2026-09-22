# Phase 0 Research — Public Widget Polling & Outbound Amplification

**Feature**: `045-public-widget-visibility` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This research resolves R-01: a public dashboard must not turn each anonymous
browser poll into another outbound request to Pi-hole, UniFi, Sonos, or the
stocks provider. Findings were verified against the current HomeDash source
tree on 2026-09-18.

No `NEEDS CLARIFICATION` items remain.

---

## Table of Contents

- [R1. Existing polling path](#r1-existing-polling-path)
- [R2. Existing server-side caches](#r2-existing-server-side-caches)
- [R3. Shared public snapshot cache](#r3-shared-public-snapshot-cache)
- [R4. Refresh and failure semantics](#r4-refresh-and-failure-semantics)
- [R5. Cache keys, TTLs, and invalidation](#r5-cache-keys-ttls-and-invalidation)
- [R6. Rate limiting remains required](#r6-rate-limiting-remains-required)
- [R7. Security properties](#r7-security-properties)
- [R8. Test strategy](#r8-test-strategy)
- [R9. Alternatives considered](#r9-alternatives-considered)

---

## R1. Existing polling path

**Finding** — Widget polling is browser-driven. TanStack Query timers call the
authenticated API routes independently in each browser:

| Widget | Browser polling | Backend work per cache miss/request |
| --- | --- | --- |
| Pi-hole | Stats and system health poll at the configured interval (`frontend/src/state/piholeHooks.ts`). | `fetchStats()` performs two Pi-hole requests; `fetchSystemHealth()` performs one (`backend/src/services/pihole-service.ts`). |
| UniFi | Stats poll at the configured interval (`frontend/src/state/unifiHooks.ts`). | `fetchUnifiStats()` performs six controller requests in parallel (`backend/src/services/unifi-service.ts`). |
| Sonos | Groups poll every 15s; playback and metadata each poll every 5s (`frontend/src/hooks/useSonos.ts`). | Local and cloud adapter calls read the Sonos system on every request; local discovery alone is cached for 30s (`backend/src/services/sonos-adapter.ts`, `sonos-local-service.ts`). |
| Stocks | Quotes default to 5 minutes; market status to 5 minutes (`frontend/src/hooks/useStocks.ts`). | Quotes and FX rates pass through service caches (`backend/src/services/stock-service.ts`). |
| App shortcuts | No interval polling (`frontend/src/state/appShortcutHooks.ts`). | SQLite read only (`backend/src/services/appShortcutService.ts`). |

TanStack Query deduplicates requests only inside one browser's query client. It
does not coalesce requests from separate devices or browser sessions. Reusing
the existing frontend polling hooks with a public URL would therefore make
outbound load proportional to the number of anonymous viewers.

**Conclusion** — There is no existing server-side polling path that can simply
be reused for public viewers.

---

## R2. Existing server-side caches

**Finding** — Existing caches solve narrower problems and do not provide a
shared public data snapshot:

- **Pi-hole** caches authenticated sessions for four minutes and coalesces
  concurrent login attempts. It does not cache stats or system-health payloads.
- **UniFi** caches controller sessions for three hours and coalesces concurrent
  login attempts. It does not cache stats payloads.
- **Sonos local mode** caches discovered device objects for 30 seconds, but
  group, playback, metadata, and volume reads still contact speakers. Sonos
  cloud mode has no response-data cache.
- **Stocks** caches quotes for 60 seconds, candles for 30 minutes, and FX rates
  for 15 minutes. This is useful prior art, but concurrent misses are not
  coalesced and callers can still queue provider work through the token bucket.
- **Weather** has a bounded in-memory response cache
  (`backend/src/services/weatherProxyService.ts`). It demonstrates that
  process-local TTL caching is an accepted pattern for public, non-persistent
  data in HomeDash.
- **App shortcuts** are local SQLite data and create no outbound amplification.

**Decision** — Keep those integration-specific caches unchanged. Add one
public-surface cache around the complete, already-projected widget payload. The
cache protects the public endpoint regardless of whether an underlying
integration has its own cache.

---

## R3. Shared public snapshot cache

**Decision** — Add a process-local, demand-driven `publicWidgetSnapshotCache`
used only by the new public widget data namespace.

For each publicly available widget:

1. Resolve the widget through the currently designated public dashboard.
2. Confirm its visibility mode and supported type.
3. Derive a server-owned cache key from the resolved widget identity and
   public resource kind.
4. Return a fresh cached safe payload when present.
5. Otherwise run exactly one projection/fetch operation and share that promise
   with all concurrent callers.
6. Cache only the projected public payload, never integration configuration or
   raw provider responses.

This is a **read-through cache**, not a permanent background poller. With no
anonymous viewers, it generates no outbound traffic. With any number of
viewers, it generates at most one refresh per cache key per freshness window.

The cache belongs in a dedicated backend service rather than in Fastify route
handlers, so its concurrency and expiry behavior can be unit-tested without
HTTP setup. It must expose narrow operations equivalent to:

```ts
getOrRefresh(key, policy, loader)
invalidateWidget(widgetId)
clear()
```

`getOrRefresh` stores an in-flight promise before awaiting the loader. This
single-flight property is mandatory: a TTL cache without request coalescing
still permits a burst of simultaneous viewers to cause duplicate outbound
calls at expiry.

---

## R4. Refresh and failure semantics

**Decision** — Use bounded stale-while-revalidate behavior:

- **Fresh entry**: return immediately.
- **Expired entry with a cached value**: return the stale value immediately and
  allow one caller to start the shared refresh.
- **No cached value**: callers await one shared initial load.
- **Refresh failure with a cached value**: retain the stale value for a bounded
  stale window and set a retry delay.
- **Initial-load failure**: cache a generic unavailable result for a short
  failure-backoff window so hostile callers cannot turn a failing integration
  into a tight retry loop.
- **Stale window exhausted**: return the same generic unavailable response as
  an initial-load failure; never expose provider error text.

The public authorization decision runs **before every cache lookup**. A cached
payload is therefore never sufficient authority to serve a widget. If the
dashboard designation changes, visibility is revoked, or the widget is
deleted, the next request is denied even if an old snapshot remains in memory.

Public routes should map unsupported, unavailable, hidden, private-dashboard,
and missing widgets to the same externally observable not-found response where
required by FR-010. Operational logs may distinguish the internal cause, but
must not include credentials, tokens, provider URLs, or raw provider bodies.

---

## R5. Cache keys, TTLs, and invalidation

**Decision** — Key snapshots by the resolved widget id and public resource:

```text
<widget-type>:<widget-id>:<resource>
```

The widget id is safe only after server-side resolution through the public
dashboard. Caller-supplied integration ids, group ids, symbols, URLs, and
connection ids must not become independent public cache keys.

Initial policy:

| Resource | Fresh TTL | Maximum stale window | Reason |
| --- | ---: | ---: | --- |
| Pi-hole stats + system | `max(configured poll interval, 10s)` | 2 minutes | One public snapshot should cover both existing browser reads and avoid three outbound calls per viewer. |
| UniFi stats | `max(configured poll interval, 30s)` | 5 minutes | A refresh fans out to six controller requests; a longer floor is appropriate. |
| Sonos now-playing snapshot | 5s | 30s | Preserves the existing now-playing feel while bounding work to one refresh per widget. |
| Stocks quotes + market state | 60s | 15 minutes | Matches the existing quote cache and avoids duplicate public route/provider calls. |
| App shortcuts | 60s | 5 minutes | No outbound host; TTL limits repeated SQLite work while preserving prompt admin updates through explicit invalidation. |

The exact constants should live together in the public snapshot service, not
be duplicated across route handlers.

**Explicit invalidation** is required when:

- widget public visibility changes;
- widget configuration changes;
- a widget is deleted;
- the designated public dashboard changes;
- app shortcuts belonging to a public widget change.

Explicit invalidation improves immediacy, but authorization-before-cache is the
security boundary. A missed invalidation may briefly return stale display data
for an otherwise still-authorized widget; it must never make a hidden or
private-dashboard widget accessible.

Process-local storage is intentional. Snapshots are disposable observations,
not durable state, and HomeDash currently runs as a single backend process.
Restarting safely empties the cache.

---

## R6. Rate limiting remains required

**Decision** — Keep the planned per-IP Fastify rate limit on every public widget
data route in addition to the shared cache.

The controls address different threats:

- **Rate limiting** bounds inbound HTTP work and abusive enumeration by one
  client.
- **The shared snapshot cache** bounds outbound integration work across all
  clients, including many source IPs or clients behind changing addresses.
- **Single-flight refresh** prevents a thundering herd at cache expiry.
- **Failure backoff** prevents an unavailable integration from being retried on
  every anonymous request.

Rate limiting alone is insufficient because an attacker can distribute requests
across addresses, while caching alone is insufficient because requests still
consume authorization, parsing, serialization, and logging work.

---

## R7. Security properties

The cache design preserves the feature's default-deny boundary:

- Authorization is evaluated on every request before cached data is considered.
- Cache keys are derived from server-resolved widgets on the designated public
  dashboard, not arbitrary integration identifiers.
- Only allowlisted, projected payloads enter the cache.
- Raw integration responses, credentials, endpoint URLs, connection ids, Sonos
  OAuth tokens, and Pi-hole/UniFi sessions never enter public cache entries.
- Existing authenticated routes and their guards remain unchanged.
- The public namespace remains GET-only.
- Docker has no public loader or cache policy and therefore cannot be served.
- Loader failures become a generic unavailable/not-found outcome; provider
  details remain in redacted structured logs only.
- Cache size must be bounded. The natural upper bound is the number of
  public-visible supported widgets, but the implementation should still remove
  invalidated/expired entries and cap the map defensively.

**Residual risk** — A deliberately exposed widget still causes HomeDash to
contact its configured integration while an anonymous viewer is active. That
is the intended feature. The mitigation is that the target was persisted by an
administrator, the widget was explicitly exposed, request inputs cannot select
a different target, and outbound frequency is bounded independently of viewer
count.

---

## R8. Test strategy

Phase 4 tests must prove the amplification control rather than merely assert a
cache hit:

| Test | Required assertion |
| --- | --- |
| Concurrent initial requests | N anonymous requests for one widget invoke the loader exactly once and receive the same projected payload. |
| Fresh-cache requests | Repeated requests inside the TTL invoke no additional loader call. |
| Expiry | The first request after expiry starts one refresh; concurrent callers do not duplicate it. |
| Failure backoff | A failed initial load is not retried until the backoff expires. |
| Stale-on-error | An expired cached value may be served only within the maximum stale window and without provider error details. |
| Revocation | A cached widget denied by the latest visibility/dashboard lookup is not served. |
| Isolation | Cache entries for different widget ids and resource kinds do not collide. |
| Projection boundary | Cached values contain none of the credential-shaped fields listed by SC-006. |
| Rate limiting | Requests are limited per route even when every response is a cache hit. |
| Docker exclusion | No loader or public route exists for Docker. |

Use fake timers and injected loaders; tests must not contact real Pi-hole,
UniFi, Sonos, or Yahoo endpoints.

---

## R9. Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Per-IP rate limiting only | Does not bound aggregate outbound calls across many viewers or addresses. |
| Reuse TanStack Query caching | Its cache is per browser process and cannot coalesce separate anonymous viewers. |
| Reuse Pi-hole/UniFi session caches | They cache authentication state, not response data; every stats request still reaches the integration. |
| Rely on the stocks service cache for every type | It is type-specific, does not cover LAN integrations, and does not single-flight concurrent misses. |
| Start a permanent server polling loop for every exposed widget | Creates outbound traffic when nobody is viewing, adds startup/shutdown lifecycle complexity, and requires synchronization with visibility/config changes. Demand-driven refresh provides the same viewer sharing without idle work. |
| Persist snapshots in SQLite | Public snapshots are ephemeral and high-churn. Persistence adds migrations, write load, stale-data recovery rules, and backup contents without improving the single-process deployment. |
| Cache raw provider responses then project per request | Increases the impact of an accidental cache exposure. Caching only the final allowlisted public shape makes the safe object the only reusable object. |

