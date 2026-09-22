/**
 * T037: Frontend API client wrapper.
 * Thin fetch wrapper adding JSON content-type, error parsing,
 * and CSRF token forwarding for state-changing requests.
 */

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.message);
    this.name = 'ApiRequestError';
  }
}

/** Base URL for API calls. Vite dev server proxies /api → backend. */
const API_BASE = '';

/** CSRF token storage (populated after login or bootstrap). */
let _csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  _csrfToken = token;
}

export function getCsrfToken(): string | null {
  return _csrfToken;
}

/**
 * Core request function. Handles JSON serialisation, CSRF headers,
 * and typed error parsing.
 */
async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {};

  // Only set Content-Type for requests that have a body
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  // Forward CSRF token for state-changing methods
  const stateMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  if (stateMutating && _csrfToken) {
    headers['X-CSRF-Token'] = _csrfToken;
  }

  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...options,
  });

  if (!response.ok) {
    let errorBody: ApiError;
    try {
      errorBody = (await response.json()) as ApiError;
    } catch {
      errorBody = {
        error: 'UNKNOWN',
        message: `HTTP ${response.status} ${response.statusText}`,
      };
    }
    throw new ApiRequestError(response.status, errorBody);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T = unknown>(path: string, options?: RequestInit) =>
    request<T>('GET', path, undefined, options),

  post: <T = unknown>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>('POST', path, body, options),

  put: <T = unknown>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>('PUT', path, body, options),

  patch: <T = unknown>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>('PATCH', path, body, options),

  delete: <T = unknown>(path: string, options?: RequestInit) =>
    request<T>('DELETE', path, undefined, options),

  /** Upload a file (multipart) — sets CSRF header but not Content-Type. */
  upload: async <T = unknown>(path: string, formData: FormData): Promise<T> => {
    const headers: Record<string, string> = {};
    if (_csrfToken) headers['X-CSRF-Token'] = _csrfToken;

    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorBody: ApiError;
      try {
        errorBody = (await response.json()) as ApiError;
      } catch {
        errorBody = {
          error: 'UNKNOWN',
          message: `HTTP ${response.status} ${response.statusText}`,
        };
      }
      throw new ApiRequestError(response.status, errorBody);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  },
};
