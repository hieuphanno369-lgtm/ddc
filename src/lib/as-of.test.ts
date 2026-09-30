import { describe, expect, it } from 'vitest';
import { carrySeries, dataStateOf, pickAsOf } from './as-of';

const rows = [{ yearMonth: '2026-06', v: 6 }, { yearMonth: '2026-07', v: 7 }, { yearMonth: '2026-09', v: 9 }];

describe('pickAsOf', () => {
  it('tháng không có dòng → mang số tháng gần nhất trước đó', () => {
    const r = pickAsOf(rows, '2026-08');
    expect(r?.row.v).toBe(7);
    expect(r?.sourceYm).toBe('2026-07');
    expect(r?.carried).toBe(true);
  });
  it('đúng tháng có dòng → carried false', () => {
    expect(pickAsOf(rows, '2026-09')).toMatchObject({ sourceYm: '2026-09', carried: false });
  });
  it('trước dòng đầu tiên → null (không mang số từ tương lai về quá khứ)', () => {
    expect(pickAsOf(rows, '2026-05')).toBeNull();
  });
  it('sau dòng cuối → mang số dòng cuối, không giới hạn số tháng (Q8)', () => {
    expect(pickAsOf(rows, '2027-12')).toMatchObject({ sourceYm: '2026-09', carried: true });
  });
  it('danh sách rỗng → null', () => {
    expect(pickAsOf([], '2026-08')).toBeNull();
  });
});

describe('carrySeries', () => {
  it('mỗi tháng = pickAsOf tại tháng đó', () => {
    const s = carrySeries(rows, ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(s.map((x) => (x ? [x.sourceYm, x.carried] : null))).toEqual([
      null, ['2026-06', false], ['2026-07', false], ['2026-07', true], ['2026-09', false], ['2026-09', true],
    ]);
  });
  it('không có tháng → mảng rỗng', () => {
    expect(carrySeries(rows, [])).toEqual([]);
  });
});

describe('dataStateOf', () => {
  it('hoàn thành tại mốc → completed, month = tháng actualFinishDate', () => {
    const a = pickAsOf(rows, '2026-08');
    expect(dataStateOf(a, 'Hoan_thanh', '2026-06-20')).toEqual({ kind: 'completed', month: '2026-06' });
  });
  it('không có số → none', () => {
    expect(dataStateOf(null, 'Chuan_bi', null)).toEqual({ kind: 'none', month: null });
  });
  it('mang số → carried với tháng nguồn', () => {
    expect(dataStateOf(pickAsOf(rows, '2026-08'), 'Dang_trien_khai', null)).toEqual({ kind: 'carried', month: '2026-07' });
  });
  it('đúng tháng → current', () => {
    expect(dataStateOf(pickAsOf(rows, '2026-09'), 'Dang_trien_khai', null)).toEqual({ kind: 'current', month: '2026-09' });
  });
  it('hoàn thành nhưng không có ngày kết thúc → rơi về carried/current/none theo AsOf', () => {
    expect(dataStateOf(pickAsOf(rows, '2026-09'), 'Hoan_thanh', null)).toEqual({ kind: 'current', month: '2026-09' });
  });
});
