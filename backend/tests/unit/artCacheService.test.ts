/**
 * T016: Unit tests for artCacheService — LRU cache + proxy logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  artHash,
  artProxyPath,
  getArt,
  clearArtCache,
} from '../../src/services/artCacheService.js';

beforeEach(() => {
  clearArtCache();
  vi.restoreAllMocks();
});

describe('artHash', () => {
  it('returns a deterministic 16-char base64url string', () => {
    const h1 = artHash('https://example.com/art.jpg');
    const h2 = artHash('https://example.com/art.jpg');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(16);
    expect(h1).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces different hashes for different URLs', () => {
    const h1 = artHash('https://a.com/1.jpg');
    const h2 = artHash('https://a.com/2.jpg');
    expect(h1).not.toBe(h2);
  });
});

describe('artProxyPath', () => {
  it('builds /api/sonos/art/:hash?src=... path', () => {
    const path = artProxyPath('https://example.com/art.jpg');
    expect(path).toContain('/api/sonos/art/');
    expect(path).toContain('?src=');
    const hash = artHash('https://example.com/art.jpg');
    expect(path).toContain(hash);
  });
});

describe('getArt', () => {
  it('fetches from origin on cache miss and caches the result', async () => {
    const fakeImage = Buffer.from('fakepng');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(Buffer.from('fakepng'), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      ),
    );

    const result = await getArt('https://example.com/art.png');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.contentType).toBe('image/png');
    expect(result.buffer).toEqual(fakeImage);

    // Second call should hit cache (no additional fetch)
    const result2 = await getArt('https://example.com/art.png');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result2.buffer).toEqual(fakeImage);
  });

  it('returns fallback 1x1 PNG on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));

    const result = await getArt('https://example.com/broken.jpg');
    expect(result.contentType).toBe('image/png');
    // Fallback PNG is 67 bytes
    expect(result.buffer.length).toBe(67);
  });

  it('returns fallback on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    const result = await getArt('https://example.com/missing.jpg');
    expect(result.contentType).toBe('image/png');
    expect(result.buffer.length).toBe(67);
  });

  it('evicts oldest entry when capacity exceeded', async () => {
    const fakeImage = Buffer.from('img');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(fakeImage, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
      ),
    );

    // Fill cache with 51 entries (exceeds MAX_ENTRIES=50)
    for (let i = 0; i < 51; i++) {
      await getArt(`https://example.com/${i}.jpg`);
    }

    // 51 fetches so far
    expect(fetchMock).toHaveBeenCalledTimes(51);

    // The first entry (i=0) was evicted — next call must re-fetch
    await getArt('https://example.com/0.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(52);

    // Recent entry (i=50) should still be cached — no new fetch
    await getArt('https://example.com/50.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(52);
  });

  it('rejects oversized responses when a max size is provided', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('too big', {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': String(5 * 1024 * 1024 + 1),
        },
      }),
    );

    await expect(
      getArt('https://example.com/oversized.png', { maxBytes: 5 * 1024 * 1024 }),
    ).rejects.toMatchObject({ statusCode: 413, reason: 'art_response_too_large' });
  });

  it('rejects non-image responses when image content is required', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      getArt('https://example.com/not-image', { requireImage: true }),
    ).rejects.toMatchObject({
      statusCode: 415,
      reason: 'art_response_invalid_content_type',
    });
  });
});
