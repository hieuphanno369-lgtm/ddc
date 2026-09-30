import { describe, expect, it } from 'vitest';
import { formatDmy, maskDmy, parseDmy } from './date-input';

describe('formatDmy', () => {
  it('ISO -> dd/mm/yyyy', () => expect(formatDmy('2026-09-29')).toBe('29/09/2026'));
  it('không phải ISO -> chuỗi rỗng', () => {
    expect(formatDmy('')).toBe('');
    expect(formatDmy('2026-02-30')).toBe('');
    expect(formatDmy('abc')).toBe('');
  });
});

describe('maskDmy (chèn / khi gõ, không chèn / cuối)', () => {
  it.each([
    ['1', '1'],
    ['15', '15'],
    ['150', '15/0'],
    ['1509', '15/09'],
    ['15092', '15/09/2'],
    ['15092026', '15/09/2026'],
    ['150920261234', '15/09/2026'],
    ['15/09/2026', '15/09/2026'],
    ['ab1c5', '15'],
    ['', ''],
  ])('%s -> %s', (raw, out) => expect(maskDmy(raw)).toBe(out));

  // T-7: dán/gõ d/m/yyyy có dấu phân tách giữ đúng ý nghĩa, ngày/tháng 1 chữ số được đệm 0.
  it.each([
    ['1/2/2026', '01/02/2026'],
    ['1-2-2026', '01/02/2026'],
    ['1.2.2026', '01/02/2026'],
    ['1/12/2026', '01/12/2026'],
    ['15/3/2026', '15/03/2026'],
    ['1/2/26', '01/02/26'],
    ['1/', '01'],
    ['1/2', '01/2'],
    ['1/2/', '01/02'],
    ['15/', '15'],
    ['15/0', '15/0'],
    ['15/09/', '15/09'],
    [' 1/2/2026 ', '01/02/2026'],
    ['1/2/20261', '01/02/2026'],
    ['12/3456', '12/34/56'],
    ['1//', '1'],
  ])('dấu phân tách %s -> %s', (raw, out) => expect(maskDmy(raw)).toBe(out));

  it('gõ từng phím "1/2/2026" ra đúng 01/02/2026 và parse được', () => {
    let text = '';
    for (const ch of '1/2/2026') text = maskDmy(text + ch);
    expect(text).toBe('01/02/2026');
    expect(parseDmy(text)).toBe('2026-02-01');
  });

  it('xoá lùi từ 01/02/2026 tới rỗng không kẹt ở dấu "/"', () => {
    let text = '01/02/2026';
    const seen: string[] = [];
    while (text) {
      text = maskDmy(text.slice(0, -1));
      seen.push(text);
    }
    expect(seen).toEqual(['01/02/202', '01/02/20', '01/02/2', '01/02', '01/0', '01', '0', '']);
  });
});

describe('parseDmy', () => {
  it('nhận dd/mm/yyyy và d/m/yyyy, phân tách / - . hoặc 8 chữ số liền', () => {
    expect(parseDmy('29/09/2026')).toBe('2026-09-29');
    expect(parseDmy('1/2/2026')).toBe('2026-02-01');
    expect(parseDmy('01-02-2026')).toBe('2026-02-01');
    expect(parseDmy('01.02.2026')).toBe('2026-02-01');
    expect(parseDmy('01022026')).toBe('2026-02-01');
    expect(parseDmy(' 29/09/2026 ')).toBe('2026-09-29');
  });

  it('ngày không tồn tại hoặc ngoài khoảng năm -> null', () => {
    expect(parseDmy('30/02/2026')).toBeNull();
    expect(parseDmy('31/04/2026')).toBeNull();
    expect(parseDmy('00/01/2026')).toBeNull();
    expect(parseDmy('01/13/2026')).toBeNull();
    expect(parseDmy('29/02/2025')).toBeNull();
    expect(parseDmy('29/02/2028')).toBe('2028-02-29');
    expect(parseDmy('01/01/1999')).toBeNull();
    expect(parseDmy('01/01/3000')).toBeNull();
  });

  it('chuỗi rác -> null (không ném lỗi)', () => {
    for (const s of ['', 'abc', '2026-09-29', '1/2', '01/02/26', '<script>', '01/02/2026x']) {
      expect(parseDmy(s), s).toBeNull();
    }
  });
});
