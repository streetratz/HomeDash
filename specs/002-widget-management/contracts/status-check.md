# API Contract: Status Check Endpoint

**Feature**: 002-widget-management
**Date**: 2025-07-17

## `POST /api/admin/status-check`

Performs HTTP health checks against a list of services from the backend. Used by the
System Status widget to check LAN service reachability without browser CORS restrictions.

### Authorization

- **Auth**: Required (session cookie)
- **Role**: Admin only (`requireAdmin`)
- **CSRF**: Required (`X-CSRF-Token` header)

### Request

```http
POST /api/admin/status-check HTTP/1.1
Content-Type: application/json
X-CSRF-Token: {csrf-token}
Cookie: homedash_session={session-id}
```

**Body**:

```json
{
  "services": [
    {
      "name": "Pi-hole",
      "url": "http://192.168.1.10/admin",
      "expectedStatus": 200,
      "timeoutSeconds": 10
    },
    {
      "name": "Grafana",
      "url": "http://192.168.1.20:3000",
      "expectedStatus": 200,
      "timeoutSeconds": 5
    }
  ]
}
```

**Validation (Zod)**:

```typescript
const StatusCheckRequestSchema = z.object({
  services: z.array(z.object({
    name: z.string().min(1).max(64),
    url: z.string().url().max(2048),
    expectedStatus: z.number().int().min(100).max(599).default(200),
    timeoutSeconds: z.number().int().min(1).max(30).default(10),
  })).min(1).max(20),
}).strict();
```

### Response

**200 OK**:

```json
{
  "results": [
    {
      "name": "Pi-hole",
      "status": "up",
      "responseTimeMs": 42,
      "checkedAt": "2025-07-17T14:30:00.000Z",
      "error": null
    },
    {
      "name": "Grafana",
      "status": "down",
      "responseTimeMs": null,
      "checkedAt": "2025-07-17T14:30:00.123Z",
      "error": "ECONNREFUSED"
    }
  ]
}
```

**Status field values**:

| Value | Meaning |
|-------|---------|
| `up` | HTTP response received and status code matches `expectedStatus` |
| `down` | Connection refused, DNS failure, timeout, or unexpected status code |
| `unknown` | Check could not be performed (should not occur in practice) |

**Error responses**:

| Status | Condition |
|--------|-----------|
| 400 | Validation error (invalid body) |
| 401 | Not authenticated |
| 403 | Not admin / CSRF validation failed |

### Implementation Notes

- Each service is checked sequentially (to avoid overwhelming the LAN)
- Uses Node.js native `fetch()` with `AbortSignal.timeout(timeoutSeconds * 1000)`
- HTTP method: `GET` (lightweight check; `HEAD` may not be supported by all services)
- Follows redirects (max 3)
- Response body is discarded (only status code matters)
- All network errors (DNS, connection, timeout) map to `status: 'down'`
- `responseTimeMs` measured from request start to response headers received
