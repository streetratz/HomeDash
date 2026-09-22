/**
 * T070 (US2): Asset service — logo upload handling.
 *
 * Responsibilities:
 * - Validate uploaded file via magic-byte MIME detection (not filename/header trust).
 * - Enforce size limits.
 * - Write file atomically (temp + rename) to the data directory.
 * - Persist metadata in uploaded_assets table.
 * - Generate favicon PNG variants using sharp after logo upload.
 * - Update app_shell_settings.logoAssetId.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { getDb } from '../db/drizzle.js';
import { uploadedAssets } from '../db/schema/index.js';
import { Errors } from '../lib/errors.js';
import { getDataDir } from '../config/dataDir.js';
import { setLogoAsset } from './shellSettingsService.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum logo file size: 5 MiB */
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/** Maximum background file size: 10 MiB */
const MAX_BACKGROUND_BYTES = 10 * 1024 * 1024;

/** Allowed content types for logo uploads */
const ALLOWED_LOGO_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

/** Map content type → file extension */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

/**
 * Favicon size variants generated from each logo upload.
 * Standard sizes used by browsers and home screen icons.
 */
const FAVICON_SIZES = [
  { filename: 'favicon-32.png', width: 32, height: 32 },
  { filename: 'favicon-192.png', width: 192, height: 192 },
  { filename: 'apple-touch-icon.png', width: 180, height: 180 },
];

// ── MIME detection via magic bytes ────────────────────────────────────────────

/**
 * Detect the content type of a file buffer via magic bytes.
 * This is more reliable than trusting the client-provided MIME type.
 * Returns null if the format is not recognised.
 */
function detectMimeFromBytes(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  // JPEG: SOI marker FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 8-byte signature 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // GIF: "GIF87a" or "GIF89a"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return 'image/gif';
  }

  // WebP: "RIFF" at 0..3 and "WEBP" at 8..11
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }

  // SVG: text-based; check the first 256 bytes for XML/SVG markers
  const textHeader = buf
    .slice(0, Math.min(256, buf.length))
    .toString('utf8')
    .trimStart()
    .toLowerCase();
  if (
    textHeader.startsWith('<svg') ||
    textHeader.startsWith('<?xml') ||
    textHeader.startsWith('<!doctype svg')
  ) {
    return 'image/svg+xml';
  }

  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadedAssetResult {
  id: string;
  kind: 'logo' | 'background' | 'icon';
  url: string;
  contentType: string;
  byteSize: number;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upload a logo image:
 * 1. Validates size and content type via magic bytes.
 * 2. Writes the file atomically to `$DATA_DIR/uploads/logo/<uuid>.<ext>`.
 * 3. Inserts an `uploaded_assets` row.
 * 4. Updates `app_shell_settings.logoAssetId`.
 * 5. Generates favicon PNG variants in the background (best-effort).
 *
 * Returns asset metadata including the public URL.
 */
export function uploadLogo(fileBuffer: Buffer, originalFilename: string): UploadedAssetResult {
  // ── Size validation ────────────────────────────────────────────────────────
  if (fileBuffer.length > MAX_LOGO_BYTES) {
    throw Errors.assetTooLarge(`Logo exceeds maximum size of ${MAX_LOGO_BYTES / 1024 / 1024} MiB`);
  }

  // ── Magic-byte content type detection ─────────────────────────────────────
  const contentType = detectMimeFromBytes(fileBuffer);
  if (!contentType || !ALLOWED_LOGO_CONTENT_TYPES.has(contentType)) {
    throw Errors.assetTypeInvalid(
      `Unsupported image format. Allowed: ${[...ALLOWED_LOGO_CONTENT_TYPES].join(', ')}`,
    );
  }

  const ext = MIME_TO_EXT[contentType] ?? '';
  const assetId = crypto.randomUUID();
  const filename = `${assetId}${ext}`;
  const storagePath = `uploads/logo/${filename}`;
  const fullPath = path.join(getDataDir(), storagePath);

  // ── SHA-256 for deduplication / integrity ──────────────────────────────────
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // ── Atomic write ──────────────────────────────────────────────────────────
  const logoDir = path.dirname(fullPath);
  fs.mkdirSync(logoDir, { recursive: true });
  const tmpPath = `${fullPath}.tmp`;
  fs.writeFileSync(tmpPath, fileBuffer);
  fs.renameSync(tmpPath, fullPath);

  // ── DB insert ─────────────────────────────────────────────────────────────
  const db = getDb();
  const now = new Date().toISOString();
  db.insert(uploadedAssets)
    .values({
      id: assetId,
      kind: 'logo',
      originalFilename: originalFilename || 'logo',
      contentType,
      byteSize: fileBuffer.length,
      sha256,
      storagePath,
      createdAt: now,
    })
    .run();

  // ── Update shell settings ─────────────────────────────────────────────────
  setLogoAsset(assetId);

  // ── Generate favicons (best-effort — never fail the upload) ───────────────
  generateFaviconVariants(fileBuffer, contentType, logoDir).catch((err: unknown) => {
    console.warn('[assetService] Failed to generate favicon variants:', err);
  });

  return {
    id: assetId,
    kind: 'logo',
    url: `/assets/data/${storagePath}`,
    contentType,
    byteSize: fileBuffer.length,
  };
}

/**
 * Upload a background image:
 * 1. Validates size and content type via magic bytes.
 * 2. Writes the file atomically to `$DATA_DIR/uploads/backgrounds/<uuid>.<ext>`.
 * 3. Inserts an `uploaded_assets` row.
 *
 * Returns asset metadata including the public URL.
 * Does NOT update any dashboard — the caller links the asset via dashboard update.
 */
export function uploadBackground(
  fileBuffer: Buffer,
  originalFilename: string,
): UploadedAssetResult {
  if (fileBuffer.length > MAX_BACKGROUND_BYTES) {
    throw Errors.assetTooLarge(
      `Background exceeds maximum size of ${MAX_BACKGROUND_BYTES / 1024 / 1024} MiB`,
    );
  }

  const contentType = detectMimeFromBytes(fileBuffer);
  if (!contentType || !ALLOWED_LOGO_CONTENT_TYPES.has(contentType)) {
    throw Errors.assetTypeInvalid(
      `Unsupported image format. Allowed: ${[...ALLOWED_LOGO_CONTENT_TYPES].join(', ')}`,
    );
  }

  const ext = MIME_TO_EXT[contentType] ?? '';
  const assetId = crypto.randomUUID();
  const filename = `${assetId}${ext}`;
  const storagePath = `uploads/backgrounds/${filename}`;
  const fullPath = path.join(getDataDir(), storagePath);

  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const bgDir = path.dirname(fullPath);
  fs.mkdirSync(bgDir, { recursive: true });
  const tmpPath = `${fullPath}.tmp`;
  fs.writeFileSync(tmpPath, fileBuffer);
  fs.renameSync(tmpPath, fullPath);

  const db = getDb();
  const now = new Date().toISOString();
  db.insert(uploadedAssets)
    .values({
      id: assetId,
      kind: 'background',
      originalFilename: originalFilename || 'background',
      contentType,
      byteSize: fileBuffer.length,
      sha256,
      storagePath,
      createdAt: now,
    })
    .run();

  return {
    id: assetId,
    kind: 'background',
    url: `/assets/data/${storagePath}`,
    contentType,
    byteSize: fileBuffer.length,
  };
}

// ── Internal ──────────────────────────────────────────────────────────────────

/**
 * Generate PNG favicon variants from the logo buffer using sharp.
 * Files are written atomically to the same logo directory.
 * @param fileBuffer  Raw image bytes
 * @param contentType Detected MIME type (used to configure sharp for SVGs)
 * @param logoDir     Absolute path to the uploads/logo directory
 */
async function generateFaviconVariants(
  fileBuffer: Buffer,
  contentType: string,
  logoDir: string,
): Promise<void> {
  for (const { filename, width, height } of FAVICON_SIZES) {
    const outPath = path.join(logoDir, filename);
    const tmpPath = `${outPath}.tmp`;

    // Create a new sharp instance per size to avoid chaining state issues.
    // SVGs need a higher density hint to rasterise at good quality.
    const image =
      contentType === 'image/svg+xml' ? sharp(fileBuffer, { density: 300 }) : sharp(fileBuffer);

    await image
      .resize(width, height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(tmpPath);

    fs.renameSync(tmpPath, outPath);
  }
}
