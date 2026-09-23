import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dockerPublish = readFileSync(
  new URL('../.github/workflows/docker-publish.yml', import.meta.url),
  'utf8',
);
const promoteRelease = readFileSync(
  new URL('../.github/workflows/promote-release.yml', import.meta.url),
  'utf8',
);

test('Docker publishing is callable only by release promotion', () => {
  assert.match(dockerPublish, /^on:\n  workflow_call:\n/m);
  assert.doesNotMatch(dockerPublish, /^  workflow_dispatch:/m);
  assert.doesNotMatch(dockerPublish, /^  push:/m);
  assert.match(dockerPublish, /ref: release/);
  assert.match(dockerPublish, /name: Validate release version state/);
  assert.match(dockerPublish, /GIT_COMMIT=\$\{\{ steps\.source\.outputs\.sha \}\}/);
});

test('preflight and promotion use the same main commit', () => {
  assert.equal(promoteRelease.match(/ref: \$\{\{ github\.sha \}\}/g)?.length, 2);
  assert.equal(
    promoteRelease.match(
      /if: github\.actor == github\.repository_owner && github\.ref == 'refs\/heads\/main'/g,
    )?.length,
    3,
  );
  assert.match(promoteRelease, /name: Verify validated main is unchanged/);
});

test('the promoted commit updates both protected branches', () => {
  assert.match(promoteRelease, /git push origin HEAD:main/);
  assert.match(promoteRelease, /git push origin HEAD:release/);
});

test('Docker publishing depends directly on completed promotion', () => {
  assert.match(promoteRelease, /^  publish:\n/m);
  assert.match(promoteRelease, /^    needs: promote$/m);
  assert.equal(
    promoteRelease.match(/uses: \.\/\.github\/workflows\/docker-publish\.yml/g)?.length,
    1,
  );
  assert.doesNotMatch(promoteRelease, /gh workflow run "Build & Push to GHCR"/);
});
