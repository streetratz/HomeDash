/**
 * Photo service — scans local folders and manages photo manifests.
 *
 * Supports two source types:
 * - folder: Recursive scan of a local server directory
 * - url_list: Explicit list of image URLs
 *
 * Security: All folder paths validated via realpath to prevent path traversal.
 * Performance: Manifests capped at 500 images with deterministic sampling.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { photoSources } from '../db/schema/index.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PhotoSource {
  id: string;
  name: string;
  type: 'folder' | 'url_list';
  config: FolderSourceConfig | UrlListSourceConfig;
  imageCount: number;
  lastScannedAt: string | null;
  createdAt: string;
}

export interface FolderSourceConfig {
  path: string;
  recursive?: boolean | undefined;
}

export interface UrlListSourceConfig {
  urls: string[];
}

export interface PhotoManifest {
  sourceId: string;
  images: string[]; // relative paths for folder, URLs for url_list
  total: number;
  scannedAt: string;
}

interface ManifestCache {
  images: string[];
  total: number;
  scannedAt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);
const MAX_MANIFEST_SIZE = 500;
const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
};

// ── Source CRUD ──────────────────────────────────────────────────────────────

export function listSources(): PhotoSource[] {
  const db = getDb();
  const rows = db.select().from(photoSources).all();
  return rows.map(rowToSource);
}

export function getSource(id: string): PhotoSource | null {
  const db = getDb();
  const row = db.select().from(photoSources).where(eq(photoSources.id, id)).get();
  return row ? rowToSource(row) : null;
}

export function createSource(
  name: string,
  type: 'folder' | 'url_list',
  config: FolderSourceConfig | UrlListSourceConfig,
): PhotoSource {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  // Validate config
  if (type === 'folder') {
    const fc = config as FolderSourceConfig;
    if (!fc.path || typeof fc.path !== 'string') {
      throw new Error('Folder source requires a valid path');
    }
    // Validate folder exists on server filesystem
    if (!fs.existsSync(fc.path)) {
      throw new Error(`Folder not found on server: ${fc.path}`);
    }
    const stat = fs.statSync(fc.path);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${fc.path}`);
    }
  } else if (type === 'url_list') {
    const uc = config as UrlListSourceConfig;
    if (!Array.isArray(uc.urls) || uc.urls.length === 0) {
      throw new Error('URL list source requires at least one URL');
    }
  }

  db.insert(photoSources)
    .values({
      id,
      name,
      type,
      configJson: JSON.stringify(config),
      createdAt: now,
    })
    .run();

  // Auto-scan so images are available immediately
  try {
    scanSource(id);
  } catch {
    // Scan failure is non-fatal — source is still created
  }

  return getSource(id)!;
}

export function updateSource(
  id: string,
  updates: {
    name?: string | undefined;
    config?: FolderSourceConfig | UrlListSourceConfig | undefined;
  },
): PhotoSource {
  const db = getDb();
  const existing = getSource(id);
  if (!existing) throw new Error('Photo source not found');

  const setValues: Record<string, unknown> = {};
  if (updates.name !== undefined) setValues['name'] = updates.name;
  if (updates.config !== undefined) setValues['configJson'] = JSON.stringify(updates.config);

  if (Object.keys(setValues).length > 0) {
    db.update(photoSources).set(setValues).where(eq(photoSources.id, id)).run();
  }

  return getSource(id)!;
}

export function deleteSource(id: string): void {
  const db = getDb();
  db.delete(photoSources).where(eq(photoSources.id, id)).run();
}

// ── Manifest / Scanning ─────────────────────────────────────────────────────

/**
 * Get or build the image manifest for a source.
 * Returns cached manifest if available, otherwise triggers scan.
 */
export function getManifest(sourceId: string): PhotoManifest {
  const db = getDb();
  const row = db.select().from(photoSources).where(eq(photoSources.id, sourceId)).get();
  if (!row) throw new Error('Photo source not found');

  // Return cached manifest if available
  if (row.manifestJson) {
    const cached = JSON.parse(row.manifestJson) as ManifestCache;
    return {
      sourceId,
      images: cached.images,
      total: cached.total,
      scannedAt: cached.scannedAt,
    };
  }

  // Build manifest
  return scanSource(sourceId);
}

/**
 * Rescan a source and update its manifest.
 */
export function scanSource(sourceId: string): PhotoManifest {
  const db = getDb();
  const row = db.select().from(photoSources).where(eq(photoSources.id, sourceId)).get();
  if (!row) throw new Error('Photo source not found');

  const config = JSON.parse(row.configJson) as FolderSourceConfig | UrlListSourceConfig;
  const now = new Date().toISOString();
  let images: string[];
  let total: number;

  if (row.type === 'folder') {
    const fc = config as FolderSourceConfig;
    const allImages = scanFolder(fc.path, fc.recursive !== false);
    total = allImages.length;
    images = sampleImages(allImages, MAX_MANIFEST_SIZE);
  } else {
    const uc = config as UrlListSourceConfig;
    total = uc.urls.length;
    images = uc.urls.slice(0, MAX_MANIFEST_SIZE);
  }

  const manifest: ManifestCache = { images, total, scannedAt: now };

  db.update(photoSources)
    .set({ manifestJson: JSON.stringify(manifest), lastScannedAt: now })
    .where(eq(photoSources.id, sourceId))
    .run();

  return { sourceId, images, total, scannedAt: now };
}

// ── Folder browsing ─────────────────────────────────────────────────────────

/** Base directory for photo mounts. Configurable via PHOTOS_DIR env var. */
const PHOTOS_BASE_DIR = process.env['PHOTOS_DIR'] || '/photos';

export interface BrowseResult {
  basePath: string;
  currentPath: string;
  directories: string[];
  imageCount: number;
}

/**
 * Browse subdirectories within the photos base directory.
 * Prevents path traversal — all paths are resolved relative to PHOTOS_BASE_DIR.
 */
export function browseFolders(relativePath?: string): BrowseResult {
  const basePath = path.resolve(PHOTOS_BASE_DIR);
  if (!fs.existsSync(basePath)) {
    return {
      basePath: PHOTOS_BASE_DIR,
      currentPath: PHOTOS_BASE_DIR,
      directories: [],
      imageCount: 0,
    };
  }

  const targetPath = relativePath ? path.resolve(basePath, relativePath) : basePath;

  // Path traversal protection
  let realTarget: string;
  try {
    realTarget = fs.realpathSync(targetPath);
  } catch {
    return {
      basePath: PHOTOS_BASE_DIR,
      currentPath: PHOTOS_BASE_DIR,
      directories: [],
      imageCount: 0,
    };
  }

  const realBase = fs.realpathSync(basePath);
  if (!realTarget.startsWith(realBase) && realTarget !== realBase) {
    return {
      basePath: PHOTOS_BASE_DIR,
      currentPath: PHOTOS_BASE_DIR,
      directories: [],
      imageCount: 0,
    };
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(realTarget, { withFileTypes: true });
  } catch {
    return { basePath: PHOTOS_BASE_DIR, currentPath: realTarget, directories: [], imageCount: 0 };
  }

  const directories: string[] = [];
  let imageCount = 0;

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // skip hidden
    if (entry.isDirectory()) {
      directories.push(entry.name);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) imageCount++;
    }
  }

  directories.sort((a, b) => a.localeCompare(b));

  return {
    basePath: PHOTOS_BASE_DIR,
    currentPath: realTarget,
    directories,
    imageCount,
  };
}

// ── Image serving ───────────────────────────────────────────────────────────

/**
 * Resolve and validate an image path for serving.
 * Returns { absolutePath, contentType } or null if invalid/not-found.
 * Prevents path traversal by validating realpath against source base.
 */
export function resolveImagePath(
  sourceId: string,
  imageKey: string,
): { absolutePath: string; contentType: string } | null {
  const source = getSource(sourceId);
  if (!source || source.type !== 'folder') return null;

  const config = source.config as FolderSourceConfig;
  const basePath = path.resolve(config.path);
  const requestedPath = path.resolve(basePath, imageKey);

  // Path traversal protection: ensure resolved path is under base
  let realPath: string;
  try {
    realPath = fs.realpathSync(requestedPath);
  } catch {
    return null; // File doesn't exist or broken symlink
  }

  const realBase = fs.realpathSync(basePath);
  if (!realPath.startsWith(realBase + path.sep) && realPath !== realBase) {
    return null; // Traversal attempt
  }

  const ext = path.extname(realPath).toLowerCase();
  const contentType = MIME_MAP[ext];
  if (!contentType) return null; // Not an image

  return { absolutePath: realPath, contentType };
}

// ── Internal helpers ────────────────────────────────────────────────────────

function scanFolder(folderPath: string, recursive: boolean): string[] {
  const basePath = path.resolve(folderPath);
  const images: string[] = [];

  if (!fs.existsSync(basePath)) return images;

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // Permission denied etc.
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && recursive) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext)) {
          // Store relative path from base
          images.push(path.relative(basePath, fullPath));
        }
      }
    }
  }

  walk(basePath);
  return images.sort();
}

/**
 * Deterministic sampling: take evenly spaced items if over max.
 */
function sampleImages(images: string[], max: number): string[] {
  if (images.length <= max) return images;
  const step = images.length / max;
  const sampled: string[] = [];
  for (let i = 0; i < max; i++) {
    sampled.push(images[Math.floor(i * step)]!);
  }
  return sampled;
}

function rowToSource(row: {
  id: string;
  name: string;
  type: string;
  configJson: string;
  manifestJson: string | null;
  lastScannedAt: string | null;
  createdAt: string;
}): PhotoSource {
  const config = JSON.parse(row.configJson) as FolderSourceConfig | UrlListSourceConfig;

  let imageCount = 0;
  if (row.manifestJson) {
    try {
      const m = JSON.parse(row.manifestJson) as ManifestCache;
      imageCount = m.total;
    } catch {
      /* ignore */
    }
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type as 'folder' | 'url_list',
    config,
    imageCount,
    lastScannedAt: row.lastScannedAt ?? null,
    createdAt: row.createdAt,
  };
}
