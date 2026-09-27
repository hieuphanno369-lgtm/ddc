import { describe, expect, it } from 'vitest';
import { generateResetToken, hashResetToken, isWellFormedResetToken } from './reset-token';

/** K2 (ke-hoach.md) - token 32 byte base64url (43 ky tu), DB chi luu SHA-256 hex (64 ky tu). */
describe('generateResetToken / hashResetToken', () => {
  it('token 43 ky tu base64url, hash 64 ky tu hex', () => {
    const { token, tokenHash } = generateResetToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashResetToken(token) === tokenHash tra ve tu generateResetToken', () => {
    const { token, tokenHash } = generateResetToken();
    expect(hashResetToken(token)).toBe(tokenHash);
  });

  it('hash khac token (khong phai chinh no)', () => {
    const { token, tokenHash } = generateResetToken();
    expect(tokenHash).not.toBe(token);
  });

  it('100 lan sinh khong trung token/hash', () => {
    const tokens = new Set<string>();
    const hashes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const { token, tokenHash } = generateResetToken();
      tokens.add(token);
      hashes.add(tokenHash);
    }
    expect(tokens.size).toBe(100);
    expect(hashes.size).toBe(100);
  });
});

describe('isWellFormedResetToken', () => {
  it('nhan dung 43 ky tu base64url', () => {
    expect(isWellFormedResetToken(generateResetToken().token)).toBe(true);
  });

  it('tu choi chuoi rong', () => {
    expect(isWellFormedResetToken('')).toBe(false);
  });

  it('tu choi 42 hoac 44 ky tu', () => {
    expect(isWellFormedResetToken('a'.repeat(42))).toBe(false);
    expect(isWellFormedResetToken('a'.repeat(44))).toBe(false);
  });

  it('tu choi ky tu + / =', () => {
    expect(isWellFormedResetToken('+'.repeat(43))).toBe(false);
    expect(isWellFormedResetToken('/'.repeat(43))).toBe(false);
    expect(isWellFormedResetToken('='.repeat(43))).toBe(false);
  });

  it('tu choi khong phai string', () => {
    expect(isWellFormedResetToken(undefined)).toBe(false);
    expect(isWellFormedResetToken(null)).toBe(false);
    expect(isWellFormedResetToken(123)).toBe(false);
  });
});
