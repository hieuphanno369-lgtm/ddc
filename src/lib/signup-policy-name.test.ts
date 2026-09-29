/** T2 (security vong 2) - ky tu tang hinh ngoai nhom \p{C} va chuan hoa khoang trang trong ho ten. */
import { describe, expect, it } from 'vitest';
import { hasInvisibleChars, normalizeSignupName } from './signup-policy';

describe('hasInvisibleChars', () => {
  it.each([
    ['LINE SEPARATOR U+2028', 'Nguyen A'],
    ['PARAGRAPH SEPARATOR U+2029', 'Nguyen A'],
    ['COMBINING GRAPHEME JOINER U+034F', 'Nguyen͏A'],
    ['Hangul choseong filler U+115F', 'ᅟNguyen'],
    ['Hangul jungseong filler U+1160', 'Nguyenᅠ'],
    ['Hangul filler U+3164', 'Nguyen ㅤ'],
    ['halfwidth Hangul filler U+FFA0', 'NguyenﾠA'],
    ['ZWJ U+200D (nhom C, da chan tu truoc)', 'Nguyen‍A'],
    ['xuong dong', 'Nguyen\nA'],
  ])('chan %s', (_n, name) => {
    expect(hasInvisibleChars(name)).toBe(true);
  });

  it.each([
    ['NFC', 'Nguyễn Văn Ấn'],
    ['NFD', 'Trần Thị Hồng Ngọc'.normalize('NFD')],
    ['co dau gach, nhay', "Lê-Anh O'Neil"],
  ])('khong chan ten tieng Viet hop le (%s)', (_n, name) => {
    expect(hasInvisibleChars(name)).toBe(false);
  });
});

describe('normalizeSignupName', () => {
  it('gop moi khoang trang Zs (NBSP, U+3000, nhieu dau cach) ve 1 dau cach thuong, cat 2 dau', () => {
    expect(normalizeSignupName('  Nguyễn Văn　　Ấn   ')).toBe('Nguyễn Văn Ấn');
  });

  it('chuyen ve NFC de ten giong nhau luu giong nhau', () => {
    expect(normalizeSignupName('Trần Thị'.normalize('NFD'))).toBe('Trần Thị'.normalize('NFC'));
  });

  it('khong phai chuoi -> chuoi rong', () => {
    expect(normalizeSignupName(undefined)).toBe('');
    expect(normalizeSignupName(42)).toBe('');
  });
});
