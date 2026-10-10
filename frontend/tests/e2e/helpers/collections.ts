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

/** Reset the isolated admin collection config to a confirmed, empty baseline. */
export async function resetCollectionsToEmpty(request: APIRequestContext, csrf: string) {
  const headers = { 'x-csrf-token': csrf };
  const config = (await (await request.get('/api/admin/calendar/collections')).json()) as {
    revision: number;
    runtimeEpoch: string;
    streams: { id: string }[];
  };
  const draft = {
    expectedRevision: config.revision,
    runtimeEpoch: config.runtimeEpoch,
    timezone: 'Australia/Sydney',
    providerLabel: null,
    streams: [],
    range: { from: '2026-10-10', to: '2026-11-10' },
    confirmations: {
      timezoneConfirmed: true,
      deletedStreamIds: config.streams.map((s) => s.id),
      removedExceptionIds: [],
      clearedExplicitStreamIds: [],
    },
  };
  const preview = await request.post('/api/admin/calendar/collections/preview', {
    headers,
    data: draft,
  });
  await expectApiOk(preview, 'Preview empty collection baseline');
  const { previewDigest } = (await preview.json()) as { previewDigest: string };
  await expectApiOk(
    await request.put('/api/admin/calendar/collections', {
      headers,
      data: { ...draft, previewDigest },
    }),
    'Reset collections to empty baseline',
  );
}
