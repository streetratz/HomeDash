// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { collectionDenied, collectionKeys } from '../../src/state/collectionHooks.js';
import { ApiRequestError } from '../../src/lib/apiClient.js';
describe('collection cache denial classification', () => {
  it('removes 401/403/404 but distinguishes safe transient failures', () => {
    for (const code of [401, 403, 404])
      expect(
        collectionDenied(new ApiRequestError(code, { error: 'DENIED', message: 'Denied' })),
      ).toBe(true);
    expect(
      collectionDenied(
        new ApiRequestError(500, { error: 'INTERNAL_ERROR', message: 'Unavailable' }),
      ),
    ).toBe(false);
    expect(collectionKeys.display('public', 'one', { daysAhead: 28 })).not.toEqual(
      collectionKeys.display('auth:one:session', 'one', { daysAhead: 28 }),
    );
  });
});
