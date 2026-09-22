import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Set SESSION_SECRET before any import that reads env
const TEST_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';
process.env['SESSION_SECRET'] = TEST_SECRET;

import { _resetEnvCache } from '../../src/config/env.js';
import {
  encryptToken,
  decryptToken,
  TokenEncryptionError,
} from '../../src/lib/token-encryption.js';

beforeAll(() => {
  _resetEnvCache();
});

afterAll(() => {
  _resetEnvCache();
});

describe('tokenEncryption', () => {
  it('round-trips a plaintext string', () => {
    const plaintext = 'my-super-secret-oauth-token';
    const encrypted = encryptToken(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertexts for different plaintexts', () => {
    const enc1 = encryptToken('token-a');
    const enc2 = encryptToken('token-b');
    expect(enc1).not.toBe(enc2);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const enc1 = encryptToken('same-token');
    const enc2 = encryptToken('same-token');
    expect(enc1).not.toBe(enc2);
    // Both must decrypt to same value
    expect(decryptToken(enc1)).toBe('same-token');
    expect(decryptToken(enc2)).toBe('same-token');
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encryptToken('secret');
    const parts = encrypted.split(':');
    // Flip a character in the ciphertext portion
    const tampered = parts[1]!;
    const flipped =
      tampered[0] === 'a'
        ? 'b' + tampered.slice(1)
        : 'a' + tampered.slice(1);
    const bad = `${parts[0]}:${flipped}:${parts[2]}`;
    expect(() => decryptToken(bad)).toThrow(TokenEncryptionError);
  });

  it('throws on truncated ciphertext', () => {
    expect(() => decryptToken('abcdef')).toThrow(TokenEncryptionError);
    expect(() => decryptToken('ab:cd')).toThrow(TokenEncryptionError);
  });

  it('encrypts and decrypts an empty string', () => {
    const encrypted = encryptToken('');
    expect(decryptToken(encrypted)).toBe('');
  });
});
