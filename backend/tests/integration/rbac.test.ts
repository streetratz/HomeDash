import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';

/* ──────────────────────────── constants ──────────────────────────── */

const ADMIN_CREDS = {
  username: 'admin',
  displayName: 'Admin',
  password: 'Pass1234!',
} as const;

const BUILT_IN_IDS = {
  administrators: '00000000-0000-4000-8000-000000000001',
  users: '00000000-0000-4000-8000-000000000002',
  viewers: '00000000-0000-4000-8000-000000000003',
} as const;

/* ──────────────────────────── types ──────────────────────────────── */

interface Permission {
  category: string;
  level: string;
}

interface GroupSummary {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: Permission[];
  memberCount: number;
}

interface MemberRow {
  userId: string;
  username: string;
  displayName: string;
  joinedAt: string;
}

/* ──────────────────────────── helpers ─────────────────────────────── */

async function setupAdmin(testApp: TestApp): Promise<void> {
  await testApp.request
    .post('/api/first-run/admin')
    .send(ADMIN_CREDS)
    .set('Content-Type', 'application/json');
}

async function loginAdmin(testApp: TestApp) {
  const res = await testApp.request
    .post('/api/auth/login')
    .send({ username: ADMIN_CREDS.username, password: ADMIN_CREDS.password })
    .set('Content-Type', 'application/json');

  return {
    sessionCookie: extractCookies(res.headers),
    csrfToken: extractCsrfToken(res.body as Record<string, unknown>),
  };
}

/* ═══════════════════════════════════════════════════════════════════ */

describe('RBAC integration tests', () => {
  let testApp: TestApp;
  let sessionCookie: string;
  let csrfToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    sessionCookie = auth.sessionCookie;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await testApp.close();
  });

  /* ─────────────── 1. /api/auth/me returns RBAC data ──────────────── */

  describe('GET /api/auth/me — RBAC data', () => {
    it('returns isAdmin, groups and permissions for admin user', async () => {
      const res = await testApp.request
        .get('/api/auth/me')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);

      const { user } = res.body as {
        user: {
          isAdmin: boolean;
          groupIds: string[];
          permissions: string[];
        };
      };

      expect(user.isAdmin).toBe(true);

      // Admin should belong to the Administrators group
      expect(Array.isArray(user.groupIds)).toBe(true);
      expect(user.groupIds).toContain(BUILT_IN_IDS.administrators);

      // Admin should have all manage-level permissions
      expect(Array.isArray(user.permissions)).toBe(true);
      for (const category of [
        'dashboards',
        'widgets',
        'settings',
        'users',
        'integrations',
      ]) {
        expect(user.permissions).toContain(`${category}:manage`);
      }
    });
  });

  /* ─────────────── 2. Group CRUD ──────────────────────────────────── */

  describe('Group CRUD — /api/admin/groups', () => {
    let customGroupId: string;

    it('lists the 3 built-in groups', async () => {
      const res = await testApp.request
        .get('/api/admin/groups')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);

      const { groups } = res.body as { groups: GroupSummary[] };
      expect(groups.length).toBeGreaterThanOrEqual(3);

      const slugs = groups.map((g) => g.slug);
      expect(slugs).toContain('administrators');
      expect(slugs).toContain('users');
      expect(slugs).toContain('viewers');

      const adminsGroup = groups.find((g) => g.slug === 'administrators');
      expect(adminsGroup?.isBuiltIn).toBe(true);
    });

    it('creates a custom group', async () => {
      const res = await testApp.request
        .post('/api/admin/groups')
        .set('Cookie', sessionCookie)
        .set(csrfHeader(csrfToken))
        .set('Content-Type', 'application/json')
        .send({
          name: 'Editors',
          description: 'Can manage dashboards and widgets',
          permissions: [
            { category: 'dashboards', level: 'manage' },
            { category: 'widgets', level: 'manage' },
          ],
        });

      expect(res.status).toBe(201);

      const { group } = res.body as { group: GroupSummary };
      expect(group.name).toBe('Editors');
      expect(group.description).toBe('Can manage dashboards and widgets');
      expect(group.isBuiltIn).toBe(false);
      expect(group.slug).toBeNull();
      expect(group.permissions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'dashboards', level: 'manage' }),
          expect.objectContaining({ category: 'widgets', level: 'manage' }),
        ]),
      );
      expect(group.memberCount).toBe(0);

      customGroupId = group.id;
    });

    it('updates a custom group name and permissions', async () => {
      const res = await testApp.request
        .patch(`/api/admin/groups/${customGroupId}`)
        .set('Cookie', sessionCookie)
        .set(csrfHeader(csrfToken))
        .set('Content-Type', 'application/json')
        .send({
          name: 'Super Editors',
          permissions: [
            { category: 'dashboards', level: 'manage' },
            { category: 'widgets', level: 'manage' },
            { category: 'settings', level: 'view' },
          ],
        });

      expect(res.status).toBe(200);

      const { group } = res.body as { group: GroupSummary };
      expect(group.name).toBe('Super Editors');
      expect(group.permissions).toHaveLength(3);
    });

    it('cannot update Administrators group permissions (403)', async () => {
      const res = await testApp.request
        .patch(`/api/admin/groups/${BUILT_IN_IDS.administrators}`)
        .set('Cookie', sessionCookie)
        .set(csrfHeader(csrfToken))
        .set('Content-Type', 'application/json')
        .send({
          permissions: [{ category: 'dashboards', level: 'view' }],
        });

      expect(res.status).toBe(403);
    });

    it('cannot delete a built-in group (403)', async () => {
      for (const id of Object.values(BUILT_IN_IDS)) {
        const res = await testApp.request
          .delete(`/api/admin/groups/${id}`)
          .set('Cookie', sessionCookie)
          .set(csrfHeader(csrfToken));

        expect(res.status).toBe(403);
      }
    });

    it('deletes a custom group', async () => {
      const res = await testApp.request
        .delete(`/api/admin/groups/${customGroupId}`)
        .set('Cookie', sessionCookie)
        .set(csrfHeader(csrfToken));

      expect(res.status).toBe(204);

      // Verify it's gone
      const listRes = await testApp.request
        .get('/api/admin/groups')
        .set('Cookie', sessionCookie);

      const { groups } = listRes.body as { groups: GroupSummary[] };
      const deleted = groups.find((g) => g.id === customGroupId);
      expect(deleted).toBeUndefined();
    });
  });

  /* ─────────────── 3. Membership management ──────────────────────── */

  describe('Membership — /api/admin/groups/:id/members', () => {
    let memberGroupId: string;
    let adminUserId: string;

    beforeAll(async () => {
      // Create a group to test membership against
      const createRes = await testApp.request
        .post('/api/admin/groups')
        .set('Cookie', sessionCookie)
        .set(csrfHeader(csrfToken))
        .set('Content-Type', 'application/json')
        .send({ name: 'MemberTest Group' });

      const { group } = createRes.body as { group: GroupSummary };
      memberGroupId = group.id;

      // Get admin userId from Administrators members
      const adminsRes = await testApp.request
        .get(`/api/admin/groups/${BUILT_IN_IDS.administrators}/members`)
        .set('Cookie', sessionCookie);

      const { members } = adminsRes.body as { members: MemberRow[] };
      adminUserId = members[0]!.userId;
    });

    it('lists members of Administrators group (has admin user)', async () => {
      const res = await testApp.request
        .get(`/api/admin/groups/${BUILT_IN_IDS.administrators}/members`)
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);

      const { members } = res.body as { members: MemberRow[] };
      expect(members.length).toBeGreaterThanOrEqual(1);

      const adminMember = members.find(
        (m) => m.username === ADMIN_CREDS.username,
      );
      expect(adminMember).toBeDefined();
      expect(adminMember!.displayName).toBe(ADMIN_CREDS.displayName);
    });

    it('adds a member to a custom group', async () => {
      const res = await testApp.request
        .post(`/api/admin/groups/${memberGroupId}/members`)
        .set('Cookie', sessionCookie)
        .set(csrfHeader(csrfToken))
        .set('Content-Type', 'application/json')
        .send({ userId: adminUserId });

      expect(res.status).toBe(201);

      // Verify membership
      const listRes = await testApp.request
        .get(`/api/admin/groups/${memberGroupId}/members`)
        .set('Cookie', sessionCookie);

      const { members } = listRes.body as { members: MemberRow[] };
      expect(members.some((m) => m.userId === adminUserId)).toBe(true);
    });

    it('removes a member from a custom group', async () => {
      const res = await testApp.request
        .delete(`/api/admin/groups/${memberGroupId}/members/${adminUserId}`)
        .set('Cookie', sessionCookie)
        .set(csrfHeader(csrfToken));

      expect(res.status).toBe(204);

      // Verify removal
      const listRes = await testApp.request
        .get(`/api/admin/groups/${memberGroupId}/members`)
        .set('Cookie', sessionCookie);

      const { members } = listRes.body as { members: MemberRow[] };
      expect(members.some((m) => m.userId === adminUserId)).toBe(false);
    });

    it('cannot remove the last admin from Administrators (403)', async () => {
      const res = await testApp.request
        .delete(
          `/api/admin/groups/${BUILT_IN_IDS.administrators}/members/${adminUserId}`,
        )
        .set('Cookie', sessionCookie)
        .set(csrfHeader(csrfToken));

      expect(res.status).toBe(403);
    });
  });

  /* ─────────────── 4. Permission gating ──────────────────────────── */

  describe('Permission gating', () => {
    describe('authentication required (401)', () => {
      it('GET /api/admin/groups', async () => {
        const res = await testApp.request.get('/api/admin/groups');
        expect(res.status).toBe(401);
      });

      it('POST /api/admin/groups', async () => {
        const res = await testApp.request
          .post('/api/admin/groups')
          .set('Content-Type', 'application/json')
          .send({ name: 'NoAuth' });
        expect(res.status).toBe(401);
      });

      it('PATCH /api/admin/groups/:id', async () => {
        const res = await testApp.request
          .patch(`/api/admin/groups/${BUILT_IN_IDS.users}`)
          .set('Content-Type', 'application/json')
          .send({ name: 'Renamed' });
        expect(res.status).toBe(401);
      });

      it('DELETE /api/admin/groups/:id', async () => {
        const res = await testApp.request.delete(
          `/api/admin/groups/${BUILT_IN_IDS.users}`,
        );
        expect(res.status).toBe(401);
      });

      it('GET /api/admin/groups/:id/members', async () => {
        const res = await testApp.request.get(
          `/api/admin/groups/${BUILT_IN_IDS.administrators}/members`,
        );
        expect(res.status).toBe(401);
      });

      it('POST /api/admin/groups/:id/members', async () => {
        const res = await testApp.request
          .post(`/api/admin/groups/${BUILT_IN_IDS.users}/members`)
          .set('Content-Type', 'application/json')
          .send({ userId: '00000000-0000-0000-0000-000000000000' });
        expect(res.status).toBe(401);
      });

      it('DELETE /api/admin/groups/:id/members/:userId', async () => {
        const res = await testApp.request.delete(
          `/api/admin/groups/${BUILT_IN_IDS.users}/members/some-user-id`,
        );
        expect(res.status).toBe(401);
      });
    });

    describe('CSRF required on mutations (403)', () => {
      it('POST /api/admin/groups without CSRF', async () => {
        const res = await testApp.request
          .post('/api/admin/groups')
          .set('Cookie', sessionCookie)
          .set('Content-Type', 'application/json')
          .send({ name: 'NoCsrf' });
        expect(res.status).toBe(403);
      });

      it('PATCH /api/admin/groups/:id without CSRF', async () => {
        const res = await testApp.request
          .patch(`/api/admin/groups/${BUILT_IN_IDS.users}`)
          .set('Cookie', sessionCookie)
          .set('Content-Type', 'application/json')
          .send({ name: 'Renamed' });
        expect(res.status).toBe(403);
      });

      it('DELETE /api/admin/groups/:id without CSRF', async () => {
        const res = await testApp.request
          .delete(`/api/admin/groups/${BUILT_IN_IDS.users}`)
          .set('Cookie', sessionCookie);
        expect(res.status).toBe(403);
      });

      it('POST /api/admin/groups/:id/members without CSRF', async () => {
        const res = await testApp.request
          .post(`/api/admin/groups/${BUILT_IN_IDS.users}/members`)
          .set('Cookie', sessionCookie)
          .set('Content-Type', 'application/json')
          .send({ userId: '00000000-0000-0000-0000-000000000000' });
        expect(res.status).toBe(403);
      });

      it('DELETE /api/admin/groups/:id/members/:userId without CSRF', async () => {
        const res = await testApp.request
          .delete(
            `/api/admin/groups/${BUILT_IN_IDS.users}/members/some-user-id`,
          )
          .set('Cookie', sessionCookie);
        expect(res.status).toBe(403);
      });
    });
  });
});
