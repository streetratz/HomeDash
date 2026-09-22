# API Contracts: Pi-hole Proxy Routes

All routes are prefixed with `/api/pihole`. All require authentication (`requireAuth`). Mutation routes (POST) additionally require CSRF (`assertCsrf`).

---

## Configuration

### `GET /api/pihole/config/:widgetInstanceId`

Get Pi-hole connection config for a widget instance (token is NOT returned).

**Auth**: requireAuth  
**Response** `200`:
```json
{
  "id": "uuid",
  "widgetInstanceId": "uuid",
  "baseUrl": "http://192.168.1.50",
  "pollIntervalSec": 30,
  "hasToken": true
}
```

**Response** `404`: Widget instance not found or no Pi-hole config.

---

### `PUT /api/pihole/config/:widgetInstanceId`

Create or update Pi-hole connection config.

**Auth**: requireAdmin + assertCsrf  
**Request Body**:
```json
{
  "baseUrl": "http://192.168.1.50",
  "apiToken": "plain-text-token-will-be-encrypted",
  "pollIntervalSec": 30
}
```

**Validation** (Zod):
- `baseUrl`: string, URL format, required
- `apiToken`: string, min 1 char, required on create; optional on update (omit to keep existing)
- `pollIntervalSec`: integer, 10–300, default 30

**Response** `200`:
```json
{
  "id": "uuid",
  "widgetInstanceId": "uuid",
  "baseUrl": "http://192.168.1.50",
  "pollIntervalSec": 30,
  "hasToken": true
}
```

---

### `POST /api/pihole/config/:widgetInstanceId/test`

Test the Pi-hole connection (validates URL reachable + token valid).

**Auth**: requireAdmin + assertCsrf  
**Request Body** (optional — uses saved config if omitted):
```json
{
  "baseUrl": "http://192.168.1.50",
  "apiToken": "plain-text-token"
}
```

**Response** `200`:
```json
{
  "success": true,
  "version": "6.0",
  "message": "Connected to Pi-hole v6.0"
}
```

**Response** `200` (failure):
```json
{
  "success": false,
  "message": "Connection refused: http://192.168.1.50"
}
```

---

## Statistics

### `GET /api/pihole/stats/:widgetInstanceId`

Fetch current DNS stats from Pi-hole (proxied).

**Auth**: requireAuth  
**Response** `200`:
```json
{
  "totalQueries": 125000,
  "blockedQueries": 15000,
  "percentBlocked": 12.0,
  "domainsOnBlocklist": 150000,
  "uniqueClients": 25,
  "blocking": "enabled",
  "timer": null
}
```

**Response** `502`: Pi-hole unreachable.  
**Response** `401`: Pi-hole rejected the token.

---

## System Health

### `GET /api/pihole/system/:widgetInstanceId`

Fetch system health metrics from Pi-hole (proxied).

**Auth**: requireAuth  
**Response** `200`:
```json
{
  "cpu": 12.5,
  "memory": 45.2,
  "load": [0.5, 0.3, 0.2],
  "temp": 52.3,
  "uptime": 86400
}
```

Fields may be `null` if not available on the Pi-hole host.

---

## Blocking Control

### `POST /api/pihole/blocking/:widgetInstanceId`

Enable or disable DNS blocking.

**Auth**: requireAdmin + assertCsrf  
**Request Body**:
```json
{
  "action": "disable",
  "duration": 300
}
```

- `action`: `"enable"` | `"disable"` (required)
- `duration`: integer, seconds (only used with `"disable"`; omit for indefinite)

**Allowed durations**: 300 (5m), 900 (15m), 1800 (30m), or `null` (indefinite).

**Response** `200`:
```json
{
  "blocking": "disabled",
  "timer": 300
}
```

**Response** `502`: Pi-hole unreachable.
