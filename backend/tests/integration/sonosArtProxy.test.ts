import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestApp,
  extractCookies,
  type TestApp,
} from '../helpers/http.js';
import { artHash, clearArtCache } from '../../src/services/artCacheService.js';

async function setupAdmin(
  testApp: TestApp,
  username = 'admin',
  password = 'supersecurepass1',
) {
  await testApp.request
    .post('/api/first-run/admin')
    .send({ username, displayName: 'Admin', password })
    .set('Content-Type', 'application/json');
}

function artPath(sourceUrl: string, hash = artHash(sourceUrl)): string {
  return `/api/sonos/art/${hash}?src=${Buffer.from(sourceUrl).toString('base64url')}`;
}

describe('GET /api/sonos/art/:hash', () => {
  let testApp: TestApp;
  let sessionCookie: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);

    const loginRes = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');

    sessionCookie = extractCookies(loginRes.headers);
  });

  beforeEach(() => {
    clearArtCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('rejects requests when the hash does not match the source URL', async () => {
    const sourceUrl = 'http://192.168.1.20/art.png';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('fetch should not be called');
    });

    const res = await testApp.request
      .get(artPath(sourceUrl, 'wrong-hash'))
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid art request');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects blocked source URLs before fetching', async () => {
    const sourceUrl = 'http://127.0.0.1/art.png';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('fetch should not be called');
    });

    const res = await testApp.request
      .get(artPath(sourceUrl))
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Art source URL is not allowed');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('proxies allowed LAN image responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Buffer.from('png'), {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': '3',
        },
      }),
    );

    const res = await testApp.request
      .get(artPath('http://192.168.1.21/art.png'))
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body).toBeInstanceOf(Buffer);
  });

  it('rejects oversized upstream responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('too big', {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': String(5 * 1024 * 1024 + 1),
        },
      }),
    );

    const res = await testApp.request
      .get(artPath('http://192.168.1.22/art.png'))
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('ASSET_TOO_LARGE');
  });

  it('rejects non-image upstream content types', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-length': '11',
        },
      }),
    );

    const res = await testApp.request
      .get(artPath('http://192.168.1.23/art.png'))
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(415);
    expect(res.body.error).toBe('ASSET_TYPE_INVALID');
  });
});
