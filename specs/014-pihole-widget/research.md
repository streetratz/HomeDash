# Research: Pi-hole v6 REST API

## Pi-hole v6 API Overview

Pi-hole v6 introduced a fully RESTful API at `/api/` (replacing the v5 `admin/api.php` endpoint). Authentication uses a Bearer token or `X-API-Key` header.

### Authentication

```
Authorization: Bearer <api_token>
```

or

```
X-API-Key: <api_token>
```

The API token is found in the Pi-hole admin UI under **Settings → API**.

Some read-only endpoints may work without auth depending on Pi-hole config, but HomeDash should always authenticate to ensure consistent access.

### Key Endpoints

#### DNS Statistics

**`GET /api/stats/summary`**

Returns a summary of DNS query statistics.

Response (key fields):
```json
{
  "queries": {
    "total": 125000,
    "blocked": 15000,
    "percent_blocked": 12.0,
    "unique_domains": 8500,
    "forwarded": 95000,
    "cached": 15000
  },
  "clients": {
    "total": 25,
    "active": 18
  },
  "gravity": {
    "domains_being_blocked": 150000,
    "last_update": 1720000000
  }
}
```

#### Blocking Status

**`GET /api/dns/blocking`**

Returns current blocking state.

Response:
```json
{
  "blocking": "enabled",
  "timer": null
}
```

When disabled with a timer:
```json
{
  "blocking": "disabled",
  "timer": 300
}
```

#### Disable Blocking

**`POST /api/dns/blocking`**

Request body:
```json
{
  "blocking": false,
  "timer": 300
}
```

- `timer` is in seconds. Omit or set to `null` for indefinite disable.

#### Enable Blocking

**`POST /api/dns/blocking`**

Request body:
```json
{
  "blocking": true
}
```

#### System Info

**`GET /api/info/system`** (or `/api/system` depending on build)

Response (key fields):
```json
{
  "cpu": {
    "usage": 12.5,
    "cores": 4
  },
  "memory": {
    "usage": 45.2,
    "total": 1073741824,
    "used": 485285478
  },
  "load": [0.5, 0.3, 0.2],
  "temp": 52.3,
  "uptime": 86400
}
```

Not all fields are available on all platforms (e.g., Docker containers may not expose temperature).

#### Version Check

**`GET /api/info/version`**

Response:
```json
{
  "version": "6.0",
  "branch": "main"
}
```

Useful for detecting v5 vs v6 and showing an unsupported-version message.

### Error Responses

Standard HTTP status codes:
- `401 Unauthorized` — invalid or missing API token
- `403 Forbidden` — token lacks required permissions
- `404 Not Found` — endpoint doesn't exist (likely v5 instance)

### Rate Limiting

Pi-hole v6 does not impose rate limiting by default on local API access. HomeDash's 30-second poll interval is well within acceptable bounds.

## Design Decisions

1. **Backend proxy pattern**: All Pi-hole calls go through HomeDash backend. This avoids CORS issues, keeps API tokens server-side, and allows centralized error handling/logging.

2. **Token storage**: Use existing `encryptToken()`/`decryptToken()` from `token-encryption.ts`. Store encrypted token in a dedicated `pihole_instances` table (not in widget `configJson` which is sent to frontend).

3. **Widget ↔ instance link**: The widget's `configJson` stores a reference ID to the `pihole_instances` row. The backend resolves this to the actual Pi-hole connection details.

4. **Polling strategy**: Frontend uses TanStack Query with `refetchInterval` set to the configured poll interval. On error, uses exponential backoff (TanStack Query built-in).

5. **v6-only support**: Check `/api/info/version` on first connect. If it 404s or returns v5, show unsupported message. No v5 compatibility layer.
