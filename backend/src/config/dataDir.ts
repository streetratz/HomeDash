/**
 * T016: Data directory resolver.
 * Resolves HOMEDASH_DATA_DIR and ensures required subdirectories exist.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getEnv } from './env.js';

/** Sub-directories created under HOMEDASH_DATA_DIR on startup. */
const REQUIRED_SUBDIRS = ['db', 'uploads', 'icon-cache', 'backups', 'ssh'] as const;

/**
 * Sub-directories that must not be readable by other users on the host.
 * `ssh` holds the private key and `known_hosts` for `ssh://` Docker endpoints;
 * OpenSSH refuses to use a key whose directory or file is group/world
 * accessible, so creating it 0700 avoids a confusing first-run failure.
 */
const RESTRICTED_SUBDIRS = new Set<string>(['ssh']);

export type DataDirSubdir = (typeof REQUIRED_SUBDIRS)[number];

let _dataDir: string | undefined;

/**
 * Returns the resolved, absolute path to the data directory and ensures
 * all required sub-directories exist. Cached after the first call.
 */
export function getDataDir(): string {
  if (_dataDir) return _dataDir;

  const raw = getEnv().HOMEDASH_DATA_DIR;
  const resolved = path.resolve(raw);
  ensureDataDirs(resolved);

  _dataDir = resolved;
  return _dataDir;
}

/**
 * Returns the absolute path to a specific data sub-directory,
 * creating it if necessary.
 */
export function getDataSubDir(subdir: DataDirSubdir): string {
  return path.join(getDataDir(), subdir);
}

function ensureDataDirs(baseDir: string): void {
  fs.mkdirSync(baseDir, { recursive: true });
  for (const sub of REQUIRED_SUBDIRS) {
    const dir = path.join(baseDir, sub);
    fs.mkdirSync(dir, { recursive: true });
    if (RESTRICTED_SUBDIRS.has(sub)) {
      // Applied on every start: mkdirSync's mode is ignored when the directory
      // already exists, and umask can weaken it when it does not.
      fs.chmodSync(dir, 0o700);
    }
  }
}

/** Reset cached data dir — only for tests. */
export function _resetDataDirCache(): void {
  _dataDir = undefined;
}
