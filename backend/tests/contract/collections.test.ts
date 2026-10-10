import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, extractCookies, extractCsrfToken, csrfHeader, type TestApp } from '../helpers/http.js';
import { collectionPreset, collectionIds, seedCollectionContext, presetExpected } from '../helpers/collectionFixtures.js';
import { getCollectionConfig } from '../../src/services/collectionService.js';
import { getDb } from '../../src/db/drizzle.js';
import { users, groups, groupPermissions, userGroupMemberships, sessions } from '../../src/db/schema/index.js';
import { hashPassword } from '../../src/auth/password.js';
import { createSession, SESSION_COOKIE_NAME } from '../../src/auth/sessionStore.js';
import { eq } from 'drizzle-orm';
import { getSqliteDb } from '../../src/db/sqlite.js';

const root = '/api/admin/calendar/collections';
describe('collection private HTTP contract', () => {
  let app: TestApp;
  let cookie: string;
  let csrf: string;
  beforeAll(async () => {
    app = await createTestApp();
    await app.request.post('/api/first-run/admin').send({ username: 'admin', displayName: 'Synthetic admin', password: 'disposable-pass1' });
    const login = await app.request.post('/api/auth/login').send({ username: 'admin', password: 'disposable-pass1' });
    cookie = extractCookies(login.headers);
    csrf = extractCsrfToken(login.body as Record<string, unknown>);
    seedCollectionContext(getDb().select().from(users).get()!.id);
  });
  afterAll(async () => { await app.close(); });
  const draft = () => {
    const config = getCollectionConfig();
    return { ...collectionPreset(), expectedRevision: config.revision, runtimeEpoch: config.runtimeEpoch,
      range: { from: '2026-10-14', to: '2026-11-10' },
      confirmations: { timezoneConfirmed: true, deletedStreamIds: [], removedExceptionIds: [], clearedExplicitStreamIds: [] } };
  };
  it('denies anonymous/invalid-session before malformed private diagnostics and missing/wrong CSRF', async () => {
    expect((await app.request.get(root)).status).toBe(401);
    expect((await app.request.get(root).set('Cookie', 'homedash_sid=expired')).status).toBe(401);
    for (const token of ['', 'wrong']) {
      const response = await app.request.post(`${root}/preview`).set('Cookie', cookie).set('x-csrf-token', token).send({ privateLabel: 'sentinel' });
      expect(response.status).toBe(403);
      expect(JSON.stringify(response.body)).not.toContain('sentinel');
    }
    expect((await app.request.post(`${root}/preview`).send('{broken')).status).toBe(401);
  });
  it('denies resident even with settings:manage, allows scoped resident reads and denies expired sessions', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const groupId = crypto.randomUUID();
    db.insert(users).values({ id, username: 'resident', displayName: 'Resident', role: 'standard', passwordHash: await hashPassword('disposable-pass1'), createdAt: now, updatedAt: now }).run();
    db.insert(groups).values({ id: groupId, name: 'Synthetic managers', createdAt: now, updatedAt: now }).run();
    db.insert(groupPermissions).values({ id: crypto.randomUUID(), groupId, category: 'settings', level: 'manage' }).run();
    db.insert(userGroupMemberships).values({ id: crypto.randomUUID(), userId: id, groupId, createdAt: now }).run();
    const { sessionId } = createSession(id);
    const resident = `${SESSION_COOKIE_NAME}=${sessionId}`;
    expect((await app.request.get(root).set('Cookie', resident)).status).toBe(403);
    for (const method of ['POST', 'PUT'] as const) {
      const response = await app.app.inject({ method, url: method === 'POST' ? `${root}/preview` : root, headers: { cookie: resident, 'content-type': 'application/json' }, payload: '{"privateLabel":invalid' });
      expect(response.statusCode).toBe(403);
    }
    expect((await app.request.get(`/api/user/calendar/widgets/${collectionIds.widget}/collections?daysAhead=1`).set('Cookie', resident)).status).toBe(200);
    db.update(sessions).set({ expiresAt: '2000-01-01T00:00:00.000Z' }).where(eq(sessions.id, sessionId)).run();
    expect((await app.request.get(root).set('Cookie', resident)).status).toBe(401);
  });
  it('returns private config, rejects strict syntax, previews without writes and saves exact oracle', async () => {
    const config = await app.request.get(root).set('Cookie', cookie);
    expect(config.status).toBe(200);
    expect(config.body).toMatchObject({ configured: false, revision: 0 });
    const invalid = await app.request.post(`${root}/preview`).set('Cookie', cookie).set(csrfHeader(csrf)).send({ ...draft(), unexpected: true });
    expect(invalid.status).toBe(422);
    const input = draft();
    const preview = await app.request.post(`${root}/preview`).set('Cookie', cookie).set(csrfHeader(csrf)).send(input);
    expect(preview.status).toBe(200);
    expect(preview.body.groups.map((g: { date: string; streams: { name: string }[] }) => [g.date, g.streams.map(s => s.name)])).toEqual(presetExpected);
    expect(getCollectionConfig().revision).toBe(0);
    const saved = await app.request.put(root).set('Cookie', cookie).set(csrfHeader(csrf)).send({ ...input, previewDigest: preview.body.previewDigest });
    expect(saved.status).toBe(200);
    expect(saved.body.revision).toBe(1);
    const stale = await app.request.put(root).set('Cookie', cookie).set(csrfHeader(csrf)).send({ ...input, previewDigest: preview.body.previewDigest });
    expect(stale.status).toBe(409);
    const display = await app.request.get(`/api/user/calendar/widgets/${collectionIds.widget}/collections?from=2026-10-14&to=2026-11-10`).set('Cookie', cookie);
    expect(display.status).toBe(200);
    expect(JSON.stringify(display.body)).not.toMatch(/providerLabel|anchorDate|runtimeEpoch|revision|exceptions/);
    for (const query of ['daysAhead=0', 'daysAhead=91', 'daysAhead=1&userId=guessed', 'from=2026-10-14']) {
      expect((await app.request.get(`/api/user/calendar/widgets/${collectionIds.widget}/collections?${query}`).set('Cookie', cookie)).status).toBe(422);
    }
  });
  it('maps scoped size and injected storage failure safely without partial save', async () => {
    const tooLarge = await app.request.put(root).set('Cookie', cookie).set(csrfHeader(csrf)).send({ value: 'x'.repeat(2 * 1024 * 1024) });
    expect(tooLarge.status).toBe(413);
    const before = getCollectionConfig();
    const input = draft();
    const preview = await app.request.post(`${root}/preview`).set('Cookie', cookie).set(csrfHeader(csrf)).send(input);
    getSqliteDb().exec("CREATE TEMP TRIGGER http_failure BEFORE UPDATE ON collection_household BEGIN SELECT RAISE(ABORT, 'private-sentinel bind SQL'); END");
    try {
      const response = await app.request.put(root).set('Cookie', cookie).set(csrfHeader(csrf)).send({ ...input, previewDigest: preview.body.previewDigest });
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toMatch(/private-sentinel|bind SQL/);
      expect(getCollectionConfig()).toEqual(before);
    } finally { getSqliteDb().exec('DROP TRIGGER http_failure'); }
  });
});
