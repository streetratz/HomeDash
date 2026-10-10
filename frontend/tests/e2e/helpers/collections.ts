import type { APIRequestContext } from '@playwright/test';
import { expectApiOk, getAdminCsrf } from '../support/admin.js';

/** Use only the managed disposable E2E server and its first-run admin session. */
export async function collectionAdminState(request: APIRequestContext) {
  const response = await request.get('/api/admin/calendar/collections');
  await expectApiOk(response, 'GET collections');
  return (await response.json()) as { revision: number; runtimeEpoch: string };
}

export async function previewAndSaveCollections(
  request: APIRequestContext,
  draft: Record<string, unknown>,
) {
  const csrf = await getAdminCsrf(request);
  const headers = { 'x-csrf-token': csrf };
  const preview = await request.post('/api/admin/calendar/collections/preview', {
    data: draft,
    headers,
  });
  await expectApiOk(preview, 'Preview collections');
  const result = (await preview.json()) as { canSave: boolean; previewDigest: string };
  if (!result.canSave) throw new Error('Synthetic collection draft has blockers');
  const save = await request.put('/api/admin/calendar/collections', {
    data: { ...draft, previewDigest: result.previewDigest },
    headers,
  });
  await expectApiOk(save, 'Save collections');
  return save;
}

/** Anonymous requests use a separate browser/request context, never admin state. */
export const collectionRolePaths = {
  admin: '/api/admin/calendar/collections',
  residentWidget: (id: string) => `/api/user/calendar/widgets/${id}/collections`,
  publicWidget: (id: string) => `/api/public/calendar/widgets/${id}/collections`,
};
