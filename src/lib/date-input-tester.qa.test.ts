import { describe, expect, it } from 'vitest';
import { formatDmy, maskDmy, parseDmy } from './date-input';

/**
 * P4 nhom F - tester: ket hop maskDmy (chay tren tung ky tu go) + parseDmy (chay khi Enter/roi o),
 * dung nhu `DateField` (setText(maskDmy(raw)) roi commit(text) -> parseDmy(text)).
 */
function typeThenCommit(keystrokes: string): string | null {
  let text = '';
  for (const ch of keystrokes) text = maskDmy(text + ch);
  return parseDmy(text);
}

describe('DateField: chuoi phim go -> ngay ISO (mask roi parse)', () => {
  it('8 chu so lien -> dd/mm/yyyy dung', () => {
    expect(maskDmy('15032026')).toBe('15/03/2026');
    expect(typeThenCommit('15032026')).toBe('2026-03-15');
  });

  it('go dung dinh dang co dau "/" -> dung', () => {
    expect(typeThenCommit('15/03/2026')).toBe('2026-03-15');
  });

  it('xoa lui qua dau "/" khong ket: "15/0" -> xoa "0" -> "15" -> xoa tiep -> "1"', () => {
    expect(maskDmy('15/0')).toBe('15/0');
    expect(maskDmy('15/')).toBe('15');
    expect(maskDmy('15')).toBe('15');
    expect(maskDmy('1')).toBe('1');
    expect(maskDmy('')).toBe('');
  });

  it('nam ngoai 2000-2999 va ngay khong ton tai -> null', () => {
    for (const bad of ['01/01/1999', '31/12/3000', '30/02/2026', '31/04/2026', '00/01/2026', '01/00/2026', '01/13/2026', '29/02/2025']) {
      expect(parseDmy(bad), bad).toBeNull();
    }
    expect(parseDmy('29/02/2028')).toBe('2028-02-29');
    expect(parseDmy('01/01/2000')).toBe('2000-01-01');
    expect(parseDmy('31/12/2999')).toBe('2999-12-31');
  });

  it('chu, ky tu la, chuoi rong, khoang trang: khong nem loi, mask chi giu chu so toi da 8', () => {
    expect(maskDmy('ab12cd34ef56gh78ij90')).toBe('12/34/5678');
    expect(maskDmy('<script>alert(1)</script>')).toBe('1');
    expect(parseDmy('')).toBeNull();
    expect(parseDmy('   ')).toBeNull();
    expect(parseDmy('abc')).toBeNull();
    expect(parseDmy("01/01/2026'; DROP TABLE x;--")).toBeNull();
  });

  it('formatDmy chi nhan ISO hop le', () => {
    expect(formatDmy('2026-03-05')).toBe('05/03/2026');
    expect(formatDmy('')).toBe('');
    expect(formatDmy('2026-02-30')).toBe('');
    expect(formatDmy('05/03/2026')).toBe('');
  });

  it('vong tron: moi ngay ISO hop le (2000..2999, mau) qua format -> mask -> parse giu nguyen', () => {
    for (const iso of ['2000-01-01', '2024-02-29', '2026-09-30', '2999-12-31', '2100-02-28']) {
      expect(parseDmy(maskDmy(formatDmy(iso)))).toBe(iso);
    }
  });

  // LOI SAN PHAM co chu y de do (T-7): parseDmy chap nhan d/m/yyyy (1/2/2026) nhung o DateField moi ky tu go/dan
  // deu qua maskDmy (chi giu chu so) nen "1/2/2026" bien thanh "12/20/26" truoc khi toi parseDmy -> bao "Ngay khong hop le".
  it('(BUG T-7) dan/go "1/2/2026" (khong dem 0) phai ra 01/02/2026', () => {
    expect(typeThenCommit('1/2/2026')).toBe('2026-02-01');
  });

  it('(BUG T-7) dan chuoi day du "1/2/2026" mot lan (paste) phai ra 01/02/2026', () => {
    expect(parseDmy(maskDmy('1/2/2026'))).toBe('2026-02-01');
  });
});
