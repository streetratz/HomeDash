import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDataSubDir, type DataDirSubdir } from '../../src/config/dataDir.js';
import { createTestApp, type TestApp } from '../helpers/http.js';

describe('public uploaded asset boundary', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('serves files stored under uploads', async () => {
    const publicPath = path.join(getDataSubDir('uploads'), 'security-test.txt');
    fs.writeFileSync(publicPath, 'public upload');

    const response = await testApp.request.get('/assets/data/uploads/security-test.txt');

    expect(response.status).toBe(200);
    expect(response.text).toBe('public upload');
  });

  it.each<DataDirSubdir>(['db', 'backups', 'ssh', 'icon-cache'])(
    'does not expose the %s data directory',
    async (subdir) => {
      const privatePath = path.join(getDataSubDir(subdir), 'private.txt');
      fs.writeFileSync(privatePath, `private ${subdir}`);

      const attempts = [
        `/assets/data/${subdir}/private.txt`,
        `/assets/data/uploads/../${subdir}/private.txt`,
        `/assets/data/uploads/%2e%2e/${subdir}/private.txt`,
        `/assets/data/uploads/%252e%252e/${subdir}/private.txt`,
      ];

      for (const requestPath of attempts) {
        const response = await testApp.request.get(requestPath);
        expect(response.status, requestPath).toBe(404);
        expect(response.text).not.toContain(`private ${subdir}`);
      }
    },
  );
});
