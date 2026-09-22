import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveLegacyVersions,
  prepareMainBump,
  preparePromotion,
  readVersionState,
  validatePullRequest,
} from './version-state.mjs';

function readme(mainVersion, releaseVersion) {
  return `# HomeDash

![Main Version](https://img.shields.io/badge/main-v${mainVersion}-blue)
![Release Version](https://img.shields.io/badge/release-v${releaseVersion}-green)
`;
}

function files(mainVersion, releaseVersion, packageVersion = releaseVersion) {
  return {
    versionsText: `${JSON.stringify({ main: mainVersion, release: releaseVersion }, null, 2)}\n`,
    packageText: `${JSON.stringify({ name: 'homedash', version: packageVersion }, null, 2)}\n`,
    readmeText: readme(mainVersion, releaseVersion),
  };
}

function packageJson(version) {
  return `${JSON.stringify({ name: 'homedash', version }, null, 2)}\n`;
}

test('validates a consistent unreleased version state', () => {
  const state = readVersionState(files('3.4.5', '3.2.5'));
  assert.deepEqual(state.versions, { main: '3.4.5', release: '3.2.5' });
});

test('increments only Main Version for a normal PR', () => {
  const result = prepareMainBump(files('3.4.5', '3.2.5'));
  assert.equal(result.version, '3.4.6');
  assert.match(result.versionsText, /"main": "3\.4\.6"/);
  assert.match(result.versionsText, /"release": "3\.2\.5"/);
  assert.match(result.readmeText, /main-v3\.4\.6-blue/);
  assert.match(result.readmeText, /release-v3\.2\.5-green/);
  assert.equal(JSON.parse(result.packageText).version, '3.2.5');
});

test('promotes the exact Main Version across minor and patch gaps', () => {
  const result = preparePromotion(files('3.4.5', '3.2.5'));

  assert.equal(result.version, '3.4.5');
  assert.deepEqual(JSON.parse(result.versionsText), { main: '3.4.5', release: '3.4.5' });
  assert.equal(JSON.parse(result.packageText).version, '3.4.5');
  assert.match(result.readmeText, /main-v3\.4\.5-blue/);
  assert.match(result.readmeText, /release-v3\.4\.5-green/);
});

test('rejects promotion when Main and Release are equal', () => {
  assert.throws(() => preparePromotion(files('3.2.5', '3.2.5')), /must be newer/);
});

test('rejects inconsistent mirrors', () => {
  assert.throws(
    () => readVersionState(files('3.2.6', '3.2.5', '3.2.4')),
    /package\.json .* must match/,
  );
  assert.throws(
    () =>
      readVersionState({
        ...files('3.2.6', '3.2.5'),
        readmeText: readme('3.2.7', '3.2.5'),
      }),
    /Main badge .* must match/,
  );
});

test('rejects malformed stable versions', () => {
  assert.throws(() => readVersionState(files('3.2', '3.2.1')), /stable MAJOR\.MINOR\.PATCH/);
  assert.throws(
    () => readVersionState(files('3.2.6', '3.2.1-beta.1')),
    /stable MAJOR\.MINOR\.PATCH/,
  );
});

test('derives the first versions.json state from legacy mirrors', () => {
  assert.deepEqual(deriveLegacyVersions(packageJson('3.2.1'), readme('3.2.5', '3.2.1')), {
    main: '3.2.5',
    release: '3.2.1',
  });
});

test('requires every normal PR to advance Main without changing Release', () => {
  const base = `${JSON.stringify({ main: '3.2.5', release: '3.2.1' })}\n`;
  assert.equal(validatePullRequest(files('3.2.6', '3.2.1'), base), '3.2.6');
  assert.throws(() => validatePullRequest(files('3.2.5', '3.2.1'), base), /must be newer/);
  assert.throws(
    () => validatePullRequest(files('3.2.6', '3.2.2'), base),
    /cannot change Release Version/,
  );
});
