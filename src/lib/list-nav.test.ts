import { describe, expect, it } from 'vitest';
import { listboxKeyAction, nextActiveIndex } from './list-nav';

describe('nextActiveIndex', () => {
  it('count 0 -> luon -1', () => {
    expect(nextActiveIndex(-1, 'ArrowDown', 0)).toBe(-1);
    expect(nextActiveIndex(2, 'ArrowUp', 0)).toBe(-1);
  });

  it('ArrowDown: current=-1 -> 0', () => {
    expect(nextActiveIndex(-1, 'ArrowDown', 3)).toBe(0);
  });

  it('ArrowDown: vong tu cuoi ve dau', () => {
    expect(nextActiveIndex(2, 'ArrowDown', 3)).toBe(0);
  });

  it('ArrowDown: giua danh sach -> +1', () => {
    expect(nextActiveIndex(0, 'ArrowDown', 3)).toBe(1);
  });

  it('ArrowUp: current=-1 -> cuoi danh sach', () => {
    expect(nextActiveIndex(-1, 'ArrowUp', 3)).toBe(2);
  });

  it('ArrowUp: vong tu dau ve cuoi', () => {
    expect(nextActiveIndex(0, 'ArrowUp', 3)).toBe(2);
  });

  it('ArrowUp: giua danh sach -> -1', () => {
    expect(nextActiveIndex(1, 'ArrowUp', 3)).toBe(0);
  });

  it('phim khac -> giu nguyen current', () => {
    expect(nextActiveIndex(1, 'Enter', 3)).toBe(1);
  });
});

describe('listboxKeyAction', () => {
  it('ArrowDown khi dang dong -> mo + active dau tien (count>0)', () => {
    expect(listboxKeyAction('ArrowDown', { open: false, active: -1, count: 3 })).toEqual({ type: 'open', active: 0 });
  });

  it('ArrowDown khi dang dong, count=0 -> mo nhung active -1', () => {
    expect(listboxKeyAction('ArrowDown', { open: false, active: -1, count: 0 })).toEqual({ type: 'open', active: -1 });
  });

  it('ArrowDown khi dang mo -> move theo nextActiveIndex', () => {
    expect(listboxKeyAction('ArrowDown', { open: true, active: 0, count: 3 })).toEqual({ type: 'move', active: 1 });
  });

  it('ArrowUp khi dang dong -> mo + active cuoi cung', () => {
    expect(listboxKeyAction('ArrowUp', { open: false, active: -1, count: 3 })).toEqual({ type: 'open', active: 2 });
  });

  it('ArrowUp khi dang mo -> move theo nextActiveIndex', () => {
    expect(listboxKeyAction('ArrowUp', { open: true, active: 0, count: 3 })).toEqual({ type: 'move', active: 2 });
  });

  it('Enter khi mo va active hop le -> choose', () => {
    expect(listboxKeyAction('Enter', { open: true, active: 1, count: 3 })).toEqual({ type: 'choose', index: 1 });
  });

  it('Enter khi active=-1 (chua chon) -> none', () => {
    expect(listboxKeyAction('Enter', { open: true, active: -1, count: 3 })).toEqual({ type: 'none' });
  });

  it('Enter khi active>=count -> none', () => {
    expect(listboxKeyAction('Enter', { open: true, active: 5, count: 3 })).toEqual({ type: 'none' });
  });

  it('Enter khi dong -> none (de Enter mac dinh cua trinh duyet chay)', () => {
    expect(listboxKeyAction('Enter', { open: false, active: -1, count: 3 })).toEqual({ type: 'none' });
  });

  it('Escape khi mo -> close', () => {
    expect(listboxKeyAction('Escape', { open: true, active: 0, count: 3 })).toEqual({ type: 'close' });
  });

  it('Escape khi dong -> none (khong nuot phim)', () => {
    expect(listboxKeyAction('Escape', { open: false, active: -1, count: 3 })).toEqual({ type: 'none' });
  });

  it('phim khac -> none', () => {
    expect(listboxKeyAction('Tab', { open: true, active: 0, count: 3 })).toEqual({ type: 'none' });
  });
});
