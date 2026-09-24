import { expect, test as base, type APIRequestContext, type APIResponse } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.e2e');

export const ADMIN_AUTH_STATE = path.join(e2eRoot, 'auth', 'admin.json');

export async function expectApiOk(response: APIResponse, operation: string): Promise<void> {
  if (response.ok()) return;

  const body = await response.text();
  throw new Error(`${operation} failed (${response.status()}): ${body}`);
}

export async function getAdminCsrf(request: APIRequestContext): Promise<string> {
  const response = await request.get('/api/auth/me');
  await expectApiOk(response, 'GET /api/auth/me');
  const body = (await response.json()) as { csrfToken?: string };
  if (!body.csrfToken) {
    throw new Error('GET /api/auth/me returned no CSRF token');
  }
  return body.csrfToken;
}

export const test = base.extend<{ csrfToken: string }>({
  csrfToken: async ({ request }, use) => {
    await use(await getAdminCsrf(request));
  },
});

export { expect };
