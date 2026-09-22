import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const MAIN_BADGE_PATTERN =
  /^!\[Main Version\]\(https:\/\/img\.shields\.io\/badge\/main-v([^-)\s]+)-blue\)$/gm;
const RELEASE_BADGE_PATTERN =
  /^!\[Release Version\]\(https:\/\/img\.shields\.io\/badge\/release-v([^-)\s]+)-green\)$/gm;

export function parseSemver(version, source) {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) {
    throw new Error(`${source} must be a stable MAJOR.MINOR.PATCH version; received "${version}"`);
  }

  const parts = match.slice(1).map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) {
    throw new Error(`${source} contains an unsafe numeric component`);
  }

  return parts;
}

export function compareSemver(left, right) {
  const leftParts = parseSemver(left, 'Main Version');
  const rightParts = parseSemver(right, 'Release Version');

  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) return Math.sign(difference);
  }

  return 0;
}

function extractSingleBadge(readme, pattern, label) {
  const matches = [...readme.matchAll(pattern)];
  if (matches.length !== 1 || !matches[0]?.[1]) {
    throw new Error(`README must contain exactly one valid ${label} badge`);
  }

  parseSemver(matches[0][1], `${label} badge`);
  return matches[0][1];
}

function parseJson(text, source) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${source} must contain valid JSON`);
  }
}

export function readVersionState({ versionsText, packageText, readmeText }) {
  const versions = parseJson(versionsText, 'versions.json');
  const packageJson = parseJson(packageText, 'package.json');

  if (typeof versions.main !== 'string' || typeof versions.release !== 'string') {
    throw new Error('versions.json must contain string main and release fields');
  }
  if (typeof packageJson.version !== 'string') {
    throw new Error('package.json version must be a string');
  }

  parseSemver(versions.main, 'versions.json main');
  parseSemver(versions.release, 'versions.json release');
  parseSemver(packageJson.version, 'package.json version');

  const mainBadge = extractSingleBadge(readmeText, MAIN_BADGE_PATTERN, 'Main Version');
  const releaseBadge = extractSingleBadge(readmeText, RELEASE_BADGE_PATTERN, 'Release Version');

  if (mainBadge !== versions.main) {
    throw new Error(`Main badge (${mainBadge}) must match versions.json main (${versions.main})`);
  }
  if (releaseBadge !== versions.release) {
    throw new Error(
      `Release badge (${releaseBadge}) must match versions.json release (${versions.release})`,
    );
  }
  if (packageJson.version !== versions.release) {
    throw new Error(
      `package.json (${packageJson.version}) must match versions.json release (${versions.release})`,
    );
  }
  if (compareSemver(versions.main, versions.release) < 0) {
    throw new Error(
      `Main Version (${versions.main}) cannot be older than Release Version (${versions.release})`,
    );
  }

  return { versions, packageJson };
}

export function deriveLegacyVersions(packageText, readmeText) {
  const packageJson = parseJson(packageText, 'base package.json');
  if (typeof packageJson.version !== 'string') {
    throw new Error('base package.json version must be a string');
  }

  parseSemver(packageJson.version, 'base package.json version');
  const main = extractSingleBadge(readmeText, MAIN_BADGE_PATTERN, 'base Main Version');
  const release = extractSingleBadge(readmeText, RELEASE_BADGE_PATTERN, 'base Release Version');

  if (release !== packageJson.version) {
    throw new Error(
      `Base Release badge (${release}) must match base package.json (${packageJson.version})`,
    );
  }

  return { main, release };
}

export function prepareMainBump(files) {
  const { versions } = readVersionState(files);
  const [major, minor, patch] = parseSemver(versions.main, 'versions.json main');
  const nextMain = `${major}.${minor}.${patch + 1}`;
  const updatedVersions = { ...versions, main: nextMain };
  const updatedReadme = files.readmeText.replace(
    MAIN_BADGE_PATTERN,
    `![Main Version](https://img.shields.io/badge/main-v${nextMain}-blue)`,
  );

  return {
    version: nextMain,
    versionsText: `${JSON.stringify(updatedVersions, null, 2)}\n`,
    packageText: files.packageText,
    readmeText: updatedReadme,
  };
}

export function preparePromotion(files) {
  const { versions, packageJson } = readVersionState(files);
  if (compareSemver(versions.main, versions.release) <= 0) {
    throw new Error(
      `Main Version (${versions.main}) must be newer than Release Version (${versions.release})`,
    );
  }

  const updatedVersions = { ...versions, release: versions.main };
  packageJson.version = versions.main;
  const updatedReadme = files.readmeText.replace(
    RELEASE_BADGE_PATTERN,
    `![Release Version](https://img.shields.io/badge/release-v${versions.main}-green)`,
  );

  return {
    version: versions.main,
    versionsText: `${JSON.stringify(updatedVersions, null, 2)}\n`,
    packageText: `${JSON.stringify(packageJson, null, 2)}\n`,
    readmeText: updatedReadme,
  };
}

export function validatePullRequest(files, baseVersionsText) {
  const { versions } = readVersionState(files);
  const baseVersions = parseJson(baseVersionsText, 'base versions.json');

  if (typeof baseVersions.main !== 'string' || typeof baseVersions.release !== 'string') {
    throw new Error('base versions.json must contain string main and release fields');
  }
  parseSemver(baseVersions.main, 'base Main Version');
  parseSemver(baseVersions.release, 'base Release Version');

  if (compareSemver(versions.main, baseVersions.main) <= 0) {
    throw new Error(
      `PR Main Version (${versions.main}) must be newer than base Main Version (${baseVersions.main})`,
    );
  }
  if (versions.release !== baseVersions.release) {
    throw new Error(
      `Normal PRs cannot change Release Version (${baseVersions.release} -> ${versions.release})`,
    );
  }

  return versions.main;
}

function readRepositoryFiles() {
  return {
    versionsText: readFileSync('versions.json', 'utf8'),
    packageText: readFileSync('package.json', 'utf8'),
    readmeText: readFileSync('README.md', 'utf8'),
  };
}

function writeRepositoryFiles(result) {
  writeFileSync('versions.json', result.versionsText);
  writeFileSync('package.json', result.packageText);
  writeFileSync('README.md', result.readmeText);
}

function run(command, argument) {
  const files = readRepositoryFiles();

  if (command === 'validate') {
    return readVersionState(files).versions.main;
  }
  if (command === 'bump-main') {
    const result = prepareMainBump(files);
    writeRepositoryFiles(result);
    return result.version;
  }
  if (command === 'promote') {
    const result = preparePromotion(files);
    writeRepositoryFiles(result);
    return result.version;
  }
  if (command === 'validate-pr') {
    if (!argument) throw new Error('validate-pr requires a base Git ref');
    let baseVersionsText;
    try {
      baseVersionsText = execFileSync('git', ['show', `${argument}:versions.json`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      const basePackageText = execFileSync('git', ['show', `${argument}:package.json`], {
        encoding: 'utf8',
      });
      const baseReadmeText = execFileSync('git', ['show', `${argument}:README.md`], {
        encoding: 'utf8',
      });
      baseVersionsText = `${JSON.stringify(
        deriveLegacyVersions(basePackageText, baseReadmeText),
        null,
        2,
      )}\n`;
    }
    return validatePullRequest(files, baseVersionsText);
  }

  throw new Error(`Unknown command "${command}"`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entrypoint === import.meta.url) {
  try {
    process.stdout.write(`${run(process.argv[2] ?? 'validate', process.argv[3])}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Version state check failed: ${message}\n`);
    process.exitCode = 1;
  }
}
