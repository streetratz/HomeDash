/**
 * T045 (US1): Password hashing helpers using argon2id.
 * Never store or log plaintext passwords.
 */

import argon2 from 'argon2';

/**
 * Hash a plaintext password with argon2id.
 * Returns an encoded hash string suitable for storage.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Verify a plaintext password against a stored argon2 hash.
 * Returns true if the password matches.
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    // argon2 throws on malformed hashes — treat as mismatch
    return false;
  }
}
