/**
 * AES-256-GCM token encryption using the resolved session secret via HKDF.
 * Format: iv_hex:ciphertext_hex:authTag_hex
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { getEnv } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const HKDF_SALT = 'homedash-oauth-tokens';
const HKDF_INFO = 'aes-key';

export class TokenEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenEncryptionError';
  }
}

function deriveKey(): Buffer {
  const secret = getEnv().SESSION_SECRET;
  return Buffer.from(hkdfSync('sha256', secret, HKDF_SALT, HKDF_INFO, 32));
}

export function encryptToken(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

export function decryptToken(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new TokenEncryptionError('Invalid ciphertext format');
  }

  const [ivHex, encHex, tagHex] = parts;

  let iv: Buffer;
  let encrypted: Buffer;
  let authTag: Buffer;
  try {
    iv = Buffer.from(ivHex!, 'hex');
    encrypted = Buffer.from(encHex!, 'hex');
    authTag = Buffer.from(tagHex!, 'hex');
  } catch {
    throw new TokenEncryptionError('Invalid hex encoding in ciphertext');
  }

  if (iv.length !== IV_LENGTH) {
    throw new TokenEncryptionError('Invalid IV length');
  }
  if (authTag.length !== 16) {
    throw new TokenEncryptionError('Invalid auth tag length');
  }

  const key = deriveKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new TokenEncryptionError('Decryption failed — data may be tampered');
  }
}
