import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hasSecretKey, openSecret, sealSecret, secretHint, SECRET_KEY_ENV } from './secret-box';

const KEY_32 = Buffer.from('a'.repeat(32), 'utf8').toString('base64');
const KEY_16 = Buffer.from('a'.repeat(16), 'utf8').toString('base64');

describe('secret-box', () => {
  const original = process.env[SECRET_KEY_ENV];

  beforeEach(() => {
    process.env[SECRET_KEY_ENV] = KEY_32;
  });

  afterEach(() => {
    if (original === undefined) delete process.env[SECRET_KEY_ENV];
    else process.env[SECRET_KEY_ENV] = original;
  });

  it('seal -> open tra dung chuoi co dau tieng Viet', () => {
    const plain = 'https://hooks.slack.com/services/Kênh cảnh báo đỏ';
    const sealed = sealSecret(plain);
    expect(openSecret(sealed)).toBe(plain);
  });

  it('2 lan seal cung chuoi ra 2 ket qua khac nhau (iv ngau nhien)', () => {
    const a = sealSecret('bi mat');
    const b = sealSecret('bi mat');
    expect(a).not.toBe(b);
  });

  it('sua 1 ky tu ciphertext -> secret_decrypt_failed', () => {
    const sealed = sealSecret('mot bi mat kha dai de sua giua chung');
    const parts = sealed.split(':');
    const ct = parts[3];
    const mid = Math.floor(ct.length / 2);
    const flipped = ct[mid] === 'A' ? 'B' : 'A';
    parts[3] = ct.slice(0, mid) + flipped + ct.slice(mid + 1);
    expect(() => openSecret(parts.join(':'))).toThrow('secret_decrypt_failed');
  });

  it('doi khoa -> secret_decrypt_failed', () => {
    const sealed = sealSecret('bi mat');
    process.env[SECRET_KEY_ENV] = Buffer.from('b'.repeat(32), 'utf8').toString('base64');
    expect(() => openSecret(sealed)).toThrow('secret_decrypt_failed');
  });

  it('thieu env -> secret_key_missing va hasSecretKey() false', () => {
    delete process.env[SECRET_KEY_ENV];
    expect(hasSecretKey()).toBe(false);
    expect(() => sealSecret('x')).toThrow('secret_key_missing');
  });

  it('khoa 16 byte -> secret_key_invalid', () => {
    process.env[SECRET_KEY_ENV] = KEY_16;
    expect(hasSecretKey()).toBe(false);
    expect(() => sealSecret('x')).toThrow('secret_key_invalid');
  });

  it("'abc' -> secret_bad_format", () => {
    expect(() => openSecret('abc')).toThrow('secret_bad_format');
  });

  it('secretHint lay 4 ky tu cuoi, chuoi ngan -> ••••', () => {
    expect(secretHint('https://hooks.x/abcd1234')).toBe('••••1234');
    expect(secretHint('ab')).toBe('••••');
  });
});
