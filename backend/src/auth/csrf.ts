/**
 * T047 (US1): CSRF token issuance and verification.
 *
 * Strategy: Synchronizer token pattern.
 * - Each session has a persisted `csrfSecret` (random 32-byte hex string).
 * - The server generates a time-keyed HMAC token from (timestamp + nonce + secret).
 * - Clients must include this token in `X-CSRF-Token` for all state-changing requests.
 * - The server verifies the HMAC to confirm the request originates from a valid session holder.
 *
 * Token format: `<timestamp_hex>.<nonce_hex>.<hmac_hex>`
 */

import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Errors } from '../lib/errors.js';

/** Token TTL: 24 hours. Tokens older than this are rejected. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a CSRF token tied to the given secret.
 * The token is safe to include in a JSON response body.
 */
export function generateCsrfToken(secret: string): string {
  const timestamp = Date.now().toString(16);
  const nonce = crypto.randomBytes(16).toString('hex');
  const hmac = computeHmac(secret, `${timestamp}.${nonce}`);
  return `${timestamp}.${nonce}.${hmac}`;
}

/**
 * Verify a CSRF token against the session secret.
 * Returns true if valid and not expired; false otherwise.
 */
export function verifyCsrfToken(token: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [timestamp, nonce, hmac] = parts as [string, string, string];

  // Check timestamp is valid hex and not too old
  const ts = parseInt(timestamp, 16);
  if (isNaN(ts)) return false;
  if (Date.now() - ts > TOKEN_TTL_MS) return false;

  // Verify HMAC using constant-time comparison
  const expected = computeHmac(secret, `${timestamp}.${nonce}`);
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Assert that the inbound request carries a valid CSRF token.
 * Call this at the top of any state-changing route handler.
 * Throws AppError(CSRF_INVALID, 403) if validation fails.
 * Must be async for Fastify preHandler compatibility.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function assertCsrf(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const csrfSecret = (request as unknown as { csrfSecret?: string | null }).csrfSecret;
  if (!csrfSecret) {
    throw Errors.forbidden('CSRF validation requires an active session');
  }

  const token =
    (request.headers['x-csrf-token'] as string | undefined) ??
    (request.headers['x-xsrf-token'] as string | undefined);

  if (!token || !verifyCsrfToken(token, csrfSecret)) {
    throw Errors.forbidden('Invalid or missing CSRF token');
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function computeHmac(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
