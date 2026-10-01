import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Sửa lỗi P2028: nhóm i18n riêng `loginBusy` ở cuối file, vi/en cùng key, đúng chữ đã chốt, không gạch dài. */
const read = (f: string) => JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/messages', f), 'utf-8')) as Record<string, Record<string, string>>;
const vi = read('vi.json');
const en = read('en.json');

describe('i18n loginBusy', () => {
  it('vi/en cung tap key, dung chu', () => {
    expect(Object.keys(vi.loginBusy ?? {})).toEqual(['systemBusy']);
    expect(Object.keys(en.loginBusy ?? {})).toEqual(['systemBusy']);
    expect(vi.loginBusy.systemBusy).toBe('Hệ thống đang bận, vui lòng thử lại sau.');
    expect(en.loginBusy.systemBusy).toBe('The system is busy, please try again later.');
  });
  it('khong co dau gach dai', () => {
    expect(JSON.stringify([vi.loginBusy, en.loginBusy])).not.toMatch(/[\u2013\u2014]/);
  });
  it('nhom loginBusy nam CUOI file (khong chen giua key co san)', () => {
    expect(Object.keys(vi).at(-1)).toBe('loginBusy');
    expect(Object.keys(en).at(-1)).toBe('loginBusy');
  });
});
