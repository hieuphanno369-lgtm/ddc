import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Mã hoá bí mật (webhook URL, mật khẩu SMTP) trước khi lưu DB - nền thông báo cho P3B (K5,
 * ke-hoach.md P2A). AES-256-GCM, khoá 32 byte lấy từ env `NOTIFY_SECRET_KEY` (base64).
 * P2A chưa có UI/repo dùng tới - chỉ chuẩn bị hạ tầng cho P3B.
 */
export const SECRET_KEY_ENV = 'NOTIFY_SECRET_KEY';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_LEN = 32;
const FORMAT_PREFIX = 'v1';

function readKey(): Buffer | null {
  const raw = process.env[SECRET_KEY_ENV]?.trim();
  if (!raw) return null;
  try {
    return Buffer.from(raw, 'base64');
  } catch {
    return null;
  }
}

/** true khi env có khoá base64 giải ra đúng 32 byte. */
export function hasSecretKey(): boolean {
  const key = readKey();
  return key != null && key.length === KEY_LEN;
}

/** 'v1:' + b64(iv 12 byte) + ':' + b64(tag 16 byte) + ':' + b64(ciphertext). */
export function sealSecret(plain: string): string {
  const key = readKey();
  if (!key) throw new Error('secret_key_missing');
  if (key.length !== KEY_LEN) throw new Error('secret_key_invalid');

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT_PREFIX, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Sai định dạng → 'secret_bad_format'; sai khoá/bị sửa → 'secret_decrypt_failed'. */
export function openSecret(sealed: string): string {
  const parts = sealed.split(':');
  if (parts.length !== 4 || parts[0] !== FORMAT_PREFIX) throw new Error('secret_bad_format');
  const [, ivB64, tagB64, ciphertextB64] = parts;

  let iv: Buffer;
  let tag: Buffer;
  let ciphertext: Buffer;
  try {
    iv = Buffer.from(ivB64, 'base64');
    tag = Buffer.from(tagB64, 'base64');
    ciphertext = Buffer.from(ciphertextB64, 'base64');
  } catch {
    throw new Error('secret_bad_format');
  }
  if (iv.length !== IV_LEN || tag.length !== 16) throw new Error('secret_bad_format');

  const key = readKey();
  if (!key) throw new Error('secret_key_missing');
  if (key.length !== KEY_LEN) throw new Error('secret_key_invalid');

  try {
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    throw new Error('secret_decrypt_failed');
  }
}

/** '••••' + 4 ký tự cuối; chuỗi ≤ 4 ký tự → '••••'. */
export function secretHint(plain: string): string {
  if (plain.length <= 4) return '••••';
  return `••••${plain.slice(-4)}`;
}
