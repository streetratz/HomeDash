/**
 * T118 (US1): Rate limiting configuration for auth entry points.
 *
 * Provides per-route rate limit configs for login and first-run admin creation.
 * Uses @fastify/rate-limit plugin options (applied at route registration time).
 *
 * Limits are intentionally conservative to slow brute-force attacks.
 * All responses use the standard 429 error code defined in errors.ts.
 */

import type { RateLimitOptions } from '@fastify/rate-limit';
import { AppError, ErrorCode } from '../lib/errors.js';

/**
 * Rate limit config for POST /api/auth/login.
 * Allows 10 attempts per IP per 15 minutes.
 */
export const loginRateLimit: RateLimitOptions = {
  max: 10,
  timeWindow: 15 * 60 * 1000, // 15 minutes in ms
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: (_request, context) =>
    new AppError(
      ErrorCode.TOO_MANY_REQUESTS,
      `Too many login attempts. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      429,
    ),
};

/**
 * Rate limit config for POST /api/first-run/admin.
 * Allows 5 attempts per IP per 1 hour.
 * First-run is a once-ever operation so a tight limit is appropriate.
 */
export const firstRunRateLimit: RateLimitOptions = {
  max: 5,
  timeWindow: 60 * 60 * 1000, // 1 hour in ms
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: (_request, context) =>
    new AppError(
      ErrorCode.TOO_MANY_REQUESTS,
      `Too many first-run attempts. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      429,
    ),
};

/** Limits anonymous public widget polling without replacing the shared snapshot cache. */
export const publicWidgetRateLimit: RateLimitOptions = {
  max: 120,
  timeWindow: 60 * 1000,
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: (_request, context) =>
    new AppError(
      ErrorCode.TOO_MANY_REQUESTS,
      `Too many public widget requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      429,
    ),
};
