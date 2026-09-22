/**
 * T020: Centralized API error handling with typed error codes.
 */

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** Machine-readable error codes returned in API responses. */
export const ErrorCode = {
  // Generic
  INTERNAL: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CSRF_INVALID: 'CSRF_INVALID',
  // Rate limiting
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  // Domain
  FIRST_RUN_COMPLETE: 'FIRST_RUN_COMPLETE',
  USER_CONFLICT: 'USER_CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  ASSET_TOO_LARGE: 'ASSET_TOO_LARGE',
  ASSET_TYPE_INVALID: 'ASSET_TYPE_INVALID',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  SONOS_UPSTREAM_UNAVAILABLE: 'SONOS_UPSTREAM_UNAVAILABLE',
  // Docker endpoint (043) — see data-model.md § DockerEndpointError.
  // These are deliberately NOT collapsed into one "connection failed" code:
  // each maps to different operator action, and #181 was hard to diagnose
  // precisely because every failure looked the same.
  DOCKER_INVALID_ENDPOINT: 'DOCKER_INVALID_ENDPOINT',
  DOCKER_ENDPOINT_NOT_CONFIGURED: 'DOCKER_ENDPOINT_NOT_CONFIGURED',
  DOCKER_ENDPOINT_UNREACHABLE: 'DOCKER_ENDPOINT_UNREACHABLE',
  DOCKER_SSH_AUTH_FAILED: 'DOCKER_SSH_AUTH_FAILED',
  DOCKER_SSH_HOST_KEY_FAILED: 'DOCKER_SSH_HOST_KEY_FAILED',
  DOCKER_SSH_CLIENT_MISSING: 'DOCKER_SSH_CLIENT_MISSING',
  DOCKER_REMOTE_UNAVAILABLE: 'DOCKER_REMOTE_UNAVAILABLE',
  DOCKER_API_VERSION_UNSUPPORTED: 'DOCKER_API_VERSION_UNSUPPORTED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  error: ErrorCode;
  message: string;
  details?: unknown;
}

/** Application-level error that maps to a typed API error code. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Convenience constructors */
export const Errors = {
  notFound: (msg = 'Not found') => new AppError(ErrorCode.NOT_FOUND, msg, 404),
  unauthorized: (msg = 'Authentication required') => new AppError(ErrorCode.UNAUTHORIZED, msg, 401),
  forbidden: (msg = 'Insufficient permissions') => new AppError(ErrorCode.FORBIDDEN, msg, 403),
  badRequest: (msg: string, details?: unknown) =>
    new AppError(ErrorCode.BAD_REQUEST, msg, 400, details),
  conflict: (msg: string) => new AppError(ErrorCode.RESOURCE_CONFLICT, msg, 409),
  validationError: (msg: string, details?: unknown) =>
    new AppError(ErrorCode.VALIDATION_ERROR, msg, 422, details),
  assetTooLarge: (msg: string) => new AppError(ErrorCode.ASSET_TOO_LARGE, msg, 413),
  assetTypeInvalid: (msg: string) => new AppError(ErrorCode.ASSET_TYPE_INVALID, msg, 415),
  tooManyRequests: (msg = 'Too many requests') =>
    new AppError(ErrorCode.TOO_MANY_REQUESTS, msg, 429),
} as const;

/**
 * Docker endpoint failure categories (043 / FR-010, FR-011, FR-029, FR-036).
 *
 * Every Docker connectivity failure maps to exactly one of these so the UI can
 * render actionable text. Never collapse them into a generic failure, and never
 * include credentials, key material or key paths' contents in `msg`.
 *
 * `notConfigured` is 409 rather than 404: the widget exists, it just has no
 * Docker connection linked. A 404 would be indistinguishable from "no such
 * widget", which is the ambiguity FR-010 exists to remove.
 */
export const DockerErrors = {
  invalidEndpoint: (msg: string, details?: unknown) =>
    new AppError(ErrorCode.DOCKER_INVALID_ENDPOINT, msg, 400, details),
  notConfigured: (msg = 'This widget has no Docker connection configured.') =>
    new AppError(ErrorCode.DOCKER_ENDPOINT_NOT_CONFIGURED, msg, 409),
  unreachable: (msg: string) => new AppError(ErrorCode.DOCKER_ENDPOINT_UNREACHABLE, msg, 502),
  sshAuthFailed: (msg: string) => new AppError(ErrorCode.DOCKER_SSH_AUTH_FAILED, msg, 502),
  sshHostKeyFailed: (msg: string) => new AppError(ErrorCode.DOCKER_SSH_HOST_KEY_FAILED, msg, 502),
  sshClientMissing: (msg: string) => new AppError(ErrorCode.DOCKER_SSH_CLIENT_MISSING, msg, 500),
  remoteUnavailable: (msg: string) => new AppError(ErrorCode.DOCKER_REMOTE_UNAVAILABLE, msg, 502),
  apiVersionUnsupported: (msg: string) =>
    new AppError(ErrorCode.DOCKER_API_VERSION_UNSUPPORTED, msg, 502),
} as const;

/** Send a typed error response. */
export function sendError(
  reply: FastifyReply,
  code: ErrorCode,
  message: string,
  statusCode: number,
  details?: unknown,
): void {
  const body: ApiErrorBody = { error: code, message };
  if (details !== undefined) body.details = details;
  void reply.status(statusCode).send(body);
}

/**
 * Register the global error handler on the Fastify instance.
 * Catches AppError, Zod errors, and unexpected errors.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) => {
      // AppError: known domain errors
      if (error instanceof AppError) {
        if (error.statusCode >= 500) {
          request.log.error({ err: error }, 'AppError (server)');
        } else {
          request.log.warn({ err: error }, 'AppError (client)');
        }
        return sendError(reply, error.code, error.message, error.statusCode, error.details);
      }

      // Fastify validation errors (FST_ERR_VALIDATION)
      const fastifyError = error as FastifyError;
      if (fastifyError.validation) {
        return sendError(
          reply,
          ErrorCode.VALIDATION_ERROR,
          'Request validation failed',
          400,
          fastifyError.validation,
        );
      }

      // Fastify 404
      if (fastifyError.statusCode === 404) {
        return sendError(reply, ErrorCode.NOT_FOUND, 'Route not found', 404);
      }

      // Rate limit errors from @fastify/rate-limit
      if (fastifyError.statusCode === 429) {
        return sendError(reply, ErrorCode.TOO_MANY_REQUESTS, error.message, 429);
      }

      // CSRF errors
      if (fastifyError.statusCode === 403 && fastifyError.message?.includes('csrf')) {
        return sendError(reply, ErrorCode.CSRF_INVALID, 'CSRF token invalid or missing', 403);
      }

      // Unexpected errors — log full stack, return safe message
      request.log.error({ err: error }, 'Unhandled error');
      return sendError(reply, ErrorCode.INTERNAL, 'An unexpected error occurred', 500);
    },
  );
}

/**
 * Detect SQLite unique-constraint violations from better-sqlite3.
 * The driver throws a SqliteError with code 'SQLITE_CONSTRAINT_UNIQUE'.
 */
export function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}
