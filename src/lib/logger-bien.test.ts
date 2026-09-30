import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

/**
 * P5-B Task 1 - kiem doc lap rui ro coder da tu neu: logic chong vong tham chieu dung `Set` theo
 * nhanh cha (khong dua toan cuc). Ca bien can kiem: 2 truong KHAC NHAU cung tro toi 1 object
 * (chi la CHIA SE tham chieu, KHONG PHAI vong lap that) khong duoc bao `unserializable` oan.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger - bien: chia se tham chieu (khong phai vong lap) khong bi bao unserializable oan', () => {
  it('2 truong dinh cung mot object o cap 1 - van in day du du lieu, khong logError', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const shared = { a: 1, b: 'x' };
    logger.warn('shared.top_level', { field1: shared, field2: shared });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.logError).toBeUndefined();
    expect(line.field1).toEqual({ a: 1, b: 'x' });
    expect(line.field2).toEqual({ a: 1, b: 'x' });
  });

  it('2 nhanh con (sibling) trong cung 1 truong cung tro toi mot object long nhau', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const shared = { v: 1 };
    logger.warn('shared.nested_sibling', { ctx: { x: shared, y: shared } });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.logError).toBeUndefined();
    expect(line.ctx.x).toEqual({ v: 1 });
    expect(line.ctx.y).toEqual({ v: 1 });
  });

  it('mang duoc chia se giua 2 truong khac nhau', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sharedArr = [1, 2, 3];
    logger.warn('shared.array', { a: sharedArr, b: sharedArr });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.logError).toBeUndefined();
    expect(line.a).toEqual([1, 2, 3]);
    expect(line.b).toEqual([1, 2, 3]);
  });

  it('object duoc dung lai (cung tham chieu) o 2 phan tu khac nhau cua 1 mang', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const shared = { same: true };
    logger.warn('shared.in_array', { list: [shared, shared] });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.logError).toBeUndefined();
    expect(line.list).toEqual([{ same: true }, { same: true }]);
  });

  it('doi chung: vong lap THAT (object tu tro chinh no) van phai bi bao unserializable', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    logger.error('real.cycle', { data: circular });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.logError).toBe('unserializable');
  });
});
