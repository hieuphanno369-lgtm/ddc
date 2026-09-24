import { describe, expect, it } from 'vitest';
import { safeCell } from './excel-safe';

describe('safeCell', () => {
  it.each([
    ["'=1+1'", '=1+1', "'=1+1"],
    ["'+x'", '+x', "'+x"],
    ["'-x'", '-x', "'-x"],
    ["'@x'", '@x', "'@x"],
    ["'\\tx'", '\tx', "'\tx"],
    ["'\\rx'", '\rx', "'\rx"],
  ] as const)('%s co tien to', (_label, input, expected) => {
    expect(safeCell(input)).toBe(expected);
  });

  it("chuoi thuong 'abc' giu nguyen", () => {
    expect(safeCell('abc')).toBe('abc');
  });

  it('number giu nguyen', () => {
    expect(safeCell(-5)).toBe(-5);
  });

  it('null giu nguyen', () => {
    expect(safeCell(null)).toBeNull();
  });
});
