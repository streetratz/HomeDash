import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  createTestApp,
  csrfHeader,
  extractCookies,
  extractCsrfToken,
  type TestApp,
} from '../helpers/http.js';
import { getDb } from '../../src/db/drizzle.js';
import {
  calendarBirthdays,
  calendarEvents,
  calendarSources,
  users,
} from '../../src/db/schema/index.js';
import { exportBackup } from '../../src/services/backupService.js';

describe('local birthday calendar API', () => {
  let testApp: TestApp;
  let cookies: string;
  let csrfToken: string;
  let sourceId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await testApp.request
      .post('/api/first-run/admin')
      .send({ username: 'admin', displayName: 'Admin', password: 'supersecurepass1' });
    const login = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' });
    cookies = extractCookies(login.headers);
    csrfToken = extractCsrfToken(login.body as Record<string, unknown>);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('requires authentication and CSRF protection', async () => {
    const unauthenticated = await testApp.request
      .post('/api/admin/calendar/birthdays/preview')
      .send({
        csvContent:
          'first_name,last_name,month,day,birth_year,notes\nAlex,Rivera,10,3,,\n',
      });
    expect(unauthenticated.status).toBe(401);

    const missingCsrf = await testApp.request
      .post('/api/admin/calendar/birthday-sources')
      .set('Cookie', cookies)
      .send({ name: 'Family Birthdays' });
    expect(missingCsrf.status).toBe(403);
  });

  it('imports CSV rows as editable records and materializes date-only events', async () => {
    const create = await testApp.request
      .post('/api/admin/calendar/birthday-sources')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'Family Birthdays', color: '#ec4899' });
    expect(create.status).toBe(201);
    sourceId = (create.body as { id: string }).id;

    const occurrence = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const month = occurrence.getUTCMonth() + 1;
    const day = occurrence.getUTCDate();
    const csv = `first_name,last_name,month,day,birth_year,notes\r\nAlex,"Rivera, Jr.",${month},${day},1990,"Imported note"\r\n`;

    const preview = await testApp.request
      .post('/api/admin/calendar/birthdays/preview')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ csvContent: csv });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ validCount: 1, invalidCount: 0 });

    const imported = await testApp.request
      .post(`/api/admin/calendar/sources/${sourceId}/birthdays/import`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ csvContent: csv, mode: 'append' });
    expect(imported.status).toBe(200);
    expect(imported.body).toMatchObject({ imported: 1, skipped: 0 });

    const listed = await testApp.request
      .get(`/api/admin/calendar/sources/${sourceId}/birthdays`)
      .set('Cookie', cookies);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    const birthday = listed.body[0] as { id: string };

    const generated = getDb()
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.sourceId, sourceId))
      .get();
    expect(generated?.startAt).toBe(
      `${occurrence.getUTCFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(
        2,
        '0',
      )}T00:00:00.000Z`,
    );

    const nextDate = new Date(occurrence);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const update = await testApp.request
      .put(`/api/admin/calendar/sources/${sourceId}/birthdays/${birthday.id}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({
        firstName: 'Alex',
        lastName: 'Edited',
        month: nextDate.getUTCMonth() + 1,
        day: nextDate.getUTCDate(),
        birthYear: 1990,
        notes: 'Changed after CSV import',
      });
    expect(update.status).toBe(200);
    expect(update.body).toMatchObject({
      firstName: 'Alex',
      lastName: 'Edited',
      notes: 'Changed after CSV import',
    });

    const updatedEvent = getDb()
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.sourceId, sourceId))
      .get();
    expect(updatedEvent?.title).toBe("Alex Edited's Birthday");
    expect(updatedEvent?.startAt.slice(5, 10)).toBe(
      `${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}-${String(
        nextDate.getUTCDate(),
      ).padStart(2, '0')}`,
    );

    expect(exportBackup().data.calendarBirthdays).toEqual([
      expect.objectContaining({ id: birthday.id, firstName: 'Alex', lastName: 'Edited' }),
    ]);
  });

  it('rejects invalid replace imports without changing existing rows', async () => {
    const before = getDb()
      .select()
      .from(calendarBirthdays)
      .where(eq(calendarBirthdays.sourceId, sourceId))
      .all();

    const response = await testApp.request
      .post(`/api/admin/calendar/sources/${sourceId}/birthdays/import`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({
        mode: 'replace',
        csvContent:
          'first_name,last_name,month,day,birth_year,notes\nBroken,,2,30,,\n',
      });
    expect(response.status).toBe(422);

    const after = getDb()
      .select()
      .from(calendarBirthdays)
      .where(eq(calendarBirthdays.sourceId, sourceId))
      .all();
    expect(after).toEqual(before);
  });

  it('exports CSV and ICS generated from the editable records', async () => {
    const csv = await testApp.request
      .get(`/api/admin/calendar/sources/${sourceId}/birthdays/export?format=csv`)
      .set('Cookie', cookies);
    expect(csv.status).toBe(200);
    expect(csv.body.content).toContain('first_name,last_name,month,day,birth_year,notes');
    expect(csv.body.content).toContain('"Alex","Edited"');

    const ics = await testApp.request
      .get(`/api/admin/calendar/sources/${sourceId}/birthdays/export?format=ics`)
      .set('Cookie', cookies);
    expect(ics.status).toBe(200);
    expect(ics.body.content).toContain('RRULE:FREQ=YEARLY');
    expect(ics.body.content).toContain("SUMMARY:Alex Edited's Birthday");
  });

  it('enforces birthday source ownership', async () => {
    const now = new Date().toISOString();
    const otherUserId = crypto.randomUUID();
    const otherSourceId = crypto.randomUUID();
    getDb()
      .insert(users)
      .values({
        id: otherUserId,
        username: 'other-user',
        displayName: 'Other User',
        role: 'standard',
        passwordHash: 'not-used',
        createdAt: now,
        updatedAt: now,
      })
      .run();
    getDb()
      .insert(calendarSources)
      .values({
        id: otherSourceId,
        userId: otherUserId,
        type: 'birthday_local',
        name: 'Private Birthdays',
        color: '#ec4899',
        syncIntervalSeconds: 86400,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const response = await testApp.request
      .get(`/api/admin/calendar/sources/${otherSourceId}/birthdays`)
      .set('Cookie', cookies);
    expect(response.status).toBe(403);

    expect(
      getDb()
        .select()
        .from(calendarSources)
        .where(and(eq(calendarSources.id, otherSourceId), eq(calendarSources.userId, otherUserId)))
        .get(),
    ).toBeDefined();
  });
});
