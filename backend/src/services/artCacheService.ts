/**
 * Sonos album art cache — in-memory LRU with TTL.
 *
 * Proxies external album art through the HomeDash backend so the browser
 * never makes cross-origin image requests to Sonos/Spotify/etc.
 * Also handles local-mode relative URLs (prepend device IP).
 */

import { createHash } from 'node:crypto';

const LOG_PREFIX = '[artCache]';
const DEFAULT_MAX_ART_BYTES = 5 * 1024 * 1024;

export class ArtFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 413 | 415,
    public readonly reason: 'art_response_too_large' | 'art_response_invalid_content_type',
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ArtFetchError';
  }
}

// ── Config ───────────────────────────────────────────────────────────────────

const MAX_ENTRIES = 50;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Types ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  buffer: Buffer;
  contentType: string;
  fetchedAt: number;
}

// ── LRU Map ──────────────────────────────────────────────────────────────────

const cache = new Map<string, CacheEntry>();

function evictStale(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.fetchedAt > TTL_MS) cache.delete(key);
  }
}

function evictLRU(): void {
  if (cache.size <= MAX_ENTRIES) return;
  // Map iteration order = insertion order; delete oldest
  const oldest = cache.keys().next().value;
  if (oldest) cache.delete(oldest);
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Generate a URL-safe hash for a source URL. */
export function artHash(sourceUrl: string): string {
  return createHash('sha256').update(sourceUrl).digest('base64url').slice(0, 16);
}

/** Build the proxy path for a source art URL. */
export function artProxyPath(sourceUrl: string): string {
  const h = artHash(sourceUrl);
  const encoded = Buffer.from(sourceUrl).toString('base64url');
  return `/api/sonos/art/${h}?src=${encoded}`;
}

/**
 * Fetch art from cache or origin. Returns the image buffer + content type.
 * On network/upstream failures returns a 1x1 transparent PNG fallback.
 */
export async function getArt(
  sourceUrl: string,
  options: { maxBytes?: number; requireImage?: boolean } = {},
): Promise<{ buffer: Buffer; contentType: string }> {
  evictStale();

  const key = artHash(sourceUrl);
  const cached = cache.get(key);

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_ART_BYTES;

  if (cached) {
    if (options.requireImage && !cached.contentType.toLowerCase().startsWith('image/')) {
      throw new ArtFetchError(
        'Album art response must be an image',
        415,
        'art_response_invalid_content_type',
        { contentType: cached.contentType },
      );
    }

    if (cached.buffer.length > maxBytes) {
      throw new ArtFetchError('Album art exceeds 5 MB limit', 413, 'art_response_too_large', {
        contentLength: cached.buffer.length,
        maxBytes,
      });
    }

    // Move to end (most-recently-used) by re-inserting
    cache.delete(key);
    cache.set(key, cached);
    return { buffer: cached.buffer, contentType: cached.contentType };
  }

  try {
    // Defense-in-depth: validate URL even if caller already checked
    const { isAllowedArtUrl } = await import('../lib/url-validator.js');
    if (!(await isAllowedArtUrl(sourceUrl))) {
      console.warn(`${LOG_PREFIX} Blocked URL: ${sourceUrl}`);
      return fallbackImage();
    }

    let currentUrl = sourceUrl;
    let redirectCount = 0;
    const MAX_REDIRECTS = 5;
    let resp!: globalThis.Response;

    // Follow redirects manually to validate each hop
    while (true) {
      resp = await fetch(currentUrl, {
        signal: AbortSignal.timeout(8_000),
        headers: { 'User-Agent': 'HomeDash/2.0' },
        redirect: 'manual',
      });

      if (resp.status >= 300 && resp.status < 400) {
        // Cancel unused redirect response body to free resources
        await resp.body?.cancel().catch(() => undefined);
        const location = resp.headers.get('location');
        if (!location || ++redirectCount > MAX_REDIRECTS) {
          console.warn(`${LOG_PREFIX} Too many redirects or missing location: ${sourceUrl}`);
          return fallbackImage();
        }
        // Resolve relative redirects
        const redirectUrl = new URL(location, currentUrl).toString();
        // Validate redirect target
        const { isAllowedArtUrl } = await import('../lib/url-validator.js');
        if (!(await isAllowedArtUrl(redirectUrl))) {
          console.warn(`${LOG_PREFIX} Redirect to blocked URL: ${redirectUrl}`);
          return fallbackImage();
        }
        currentUrl = redirectUrl;
        continue;
      }
      break;
    }

    if (!resp.ok) {
      console.warn(`${LOG_PREFIX} Art fetch failed: ${sourceUrl} (${resp.status})`);
      return fallbackImage();
    }

    const contentType = resp.headers.get('content-type') ?? 'image/jpeg';
    if (options.requireImage && !contentType.toLowerCase().startsWith('image/')) {
      throw new ArtFetchError(
        'Album art response must be an image',
        415,
        'art_response_invalid_content_type',
        { contentType },
      );
    }

    const buffer = await readResponseBuffer(resp, maxBytes);

    const entry: CacheEntry = { buffer, contentType, fetchedAt: Date.now() };
    cache.set(key, entry);
    evictLRU();

    return { buffer, contentType };
  } catch (err) {
    if (err instanceof ArtFetchError) {
      throw err;
    }

    console.warn(`${LOG_PREFIX} Art fetch error:`, sourceUrl, err);
    return fallbackImage();
  }
}

async function readResponseBuffer(resp: Response, maxBytes: number): Promise<Buffer> {
  const contentLength = Number(resp.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ArtFetchError('Album art exceeds 5 MB limit', 413, 'art_response_too_large', {
      contentLength,
      maxBytes,
    });
  }

  if (!resp.body) {
    const arrayBuf = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (buffer.length > maxBytes) {
      throw new ArtFetchError('Album art exceeds 5 MB limit', 413, 'art_response_too_large', {
        contentLength: buffer.length,
        maxBytes,
      });
    }
    return buffer;
  }

  const reader: ReadableStreamDefaultReader<Uint8Array> = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.byteLength;
    if (total > maxBytes) {
      throw new ArtFetchError('Album art exceeds 5 MB limit', 413, 'art_response_too_large', {
        contentLength: total,
        maxBytes,
      });
    }
    chunks.push(result.value);
  }

  return Buffer.concat(chunks);
}

/** 1×1 transparent PNG fallback */
function fallbackImage(): { buffer: Buffer; contentType: string } {
  // Minimal 1×1 transparent PNG (67 bytes)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
      'Nl7BcQAAAABJRU5ErkJggg==',
    'base64',
  );
  return { buffer: png, contentType: 'image/png' };
}

/** Clear cache (useful for tests). */
export function clearArtCache(): void {
  cache.clear();
}
