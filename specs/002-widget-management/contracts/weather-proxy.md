# API Contract: Weather Proxy Endpoints

**Feature**: 002-widget-management
**Date**: 2025-07-17

## Overview

Two proxy endpoints that forward requests to Open-Meteo APIs from the backend. This keeps
the browser LAN-only (constitution: LAN-only boundary) and avoids CORS issues.

---

## `GET /api/admin/weather/current`

Fetches current weather conditions for a given latitude/longitude via Open-Meteo.

### Authorization

- **Auth**: Required (session cookie)
- **Role**: Admin only (`requireAdmin`)
- **CSRF**: Not required (GET request)

### Request

```http
GET /api/admin/weather/current?lat=51.5074&lon=-0.1278 HTTP/1.1
Cookie: homedash_session={session-id}
```

**Query parameters**:

| Param | Type | Required | Validation |
|-------|------|----------|------------|
| `lat` | number | Yes | -90 to 90 |
| `lon` | number | Yes | -180 to 180 |

### Response

**200 OK**:

```json
{
  "temperature": 11.9,
  "temperatureUnit": "C",
  "weatherCode": 0,
  "humidity": 72,
  "windSpeed": 8.5,
  "timestamp": "2025-07-17T14:15:00Z",
  "fetchedAt": "2025-07-17T14:16:23.456Z"
}
```

**WMO Weather Codes** (subset for frontend icon mapping):

| Code | Meaning | Suggested Icon |
|------|---------|---------------|
| 0 | Clear sky | ☀️ |
| 1–3 | Mainly clear / Partly cloudy / Overcast | 🌤️ / ⛅ / ☁️ |
| 45, 48 | Fog | 🌫️ |
| 51–55 | Drizzle (light/mod/dense) | 🌦️ |
| 61–65 | Rain (slight/mod/heavy) | 🌧️ |
| 71–75 | Snowfall | ❄️ |
| 80–82 | Rain showers | 🌧️ |
| 95 | Thunderstorm | ⛈️ |

**Error responses**:

| Status | Condition |
|--------|-----------|
| 400 | Missing or invalid `lat`/`lon` |
| 401 | Not authenticated |
| 403 | Not admin |
| 502 | Open-Meteo API unreachable or returned error |

### Caching

- Backend caches responses in-memory by `lat,lon` key (rounded to 2 decimal places)
- Cache TTL: 5 minutes
- On cache hit, returns cached data with the original `fetchedAt` timestamp
- On upstream failure with valid cache, returns stale cached data (with stale `fetchedAt`)

---

## `GET /api/admin/weather/geocoding`

Searches for locations by name via Open-Meteo's geocoding API.

### Authorization

- **Auth**: Required (session cookie)
- **Role**: Admin only (`requireAdmin`)
- **CSRF**: Not required (GET request)

### Request

```http
GET /api/admin/weather/geocoding?name=London HTTP/1.1
Cookie: homedash_session={session-id}
```

**Query parameters**:

| Param | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | 1–128 characters |

### Response

**200 OK**:

```json
{
  "results": [
    {
      "name": "London",
      "latitude": 51.50853,
      "longitude": -0.12574,
      "country": "United Kingdom",
      "timezone": "Europe/London",
      "population": 8961989
    },
    {
      "name": "London",
      "latitude": 42.98339,
      "longitude": -81.23304,
      "country": "Canada",
      "timezone": "America/Toronto",
      "population": 346765
    }
  ]
}
```

**Error responses**:

| Status | Condition |
|--------|-----------|
| 400 | Missing or empty `name` parameter |
| 401 | Not authenticated |
| 403 | Not admin |
| 502 | Open-Meteo geocoding API unreachable |

### Implementation Notes

- Proxies to `https://geocoding-api.open-meteo.com/v1/search?name={name}&count=5`
- No caching (transient search results)
- Results limited to 5 entries via Open-Meteo `count` parameter
- Timeout: 5 seconds

---

## Existing Endpoints Used (No Changes)

The following existing endpoints already support all widget CRUD needed for this feature:

| Endpoint | Purpose | Widget Management Role |
|----------|---------|----------------------|
| `PUT /api/admin/dashboards/:id/layout` | Batch save placeholders + widgets | Primary save path for all widget add/reorder/configure/delete |
| `POST /api/admin/placeholders/:pid/widgets` | Create single widget | Optional (batch save preferred) |
| `PUT /api/admin/widgets/:wid` | Update single widget | Optional (batch save preferred) |
| `DELETE /api/admin/widgets/:wid` | Delete single widget | Optional (batch save preferred) |
| `PUT /api/admin/placeholders/:pid/widgets/reorder` | Reorder widgets | Optional (batch save preferred) |
| `GET /api/dashboards/:id` | Fetch dashboard with children | View mode data loading |
| `GET /api/public/bootstrap` | Fetch public default dashboard | Unauthenticated view |

**Layout save payload extension** — the existing `LayoutWidgetInputSchema` already
supports the fields needed:

```typescript
// Already exists in adminDashboards.ts
const LayoutWidgetInputSchema = z.object({
  id: UuidSchema.optional(),       // omit for new widgets
  type: z.string().min(1).max(64), // widget type key
  orderIndex: z.number().int().min(0),
  configJson: z.string().optional(), // JSON string of type-specific config
});
```

The only backend change needed for existing endpoints is adding **per-type config
validation** inside the layout save handler — validating `configJson` against the
appropriate Zod schema based on the `type` field.
