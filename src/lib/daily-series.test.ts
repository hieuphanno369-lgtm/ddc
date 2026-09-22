import { describe, expect, it } from 'vitest';
import {
  bucketOf, groupByBucket, rangeLabel, sumByDate, yearsLabel, type DailyPoint,
} from './daily-series';

const p = (date: string, planned: number, actual: number): DailyPoint => ({ date, planned, actual });

describe('sumByDate - cộng ngang các nhà thầu trong CÙNG một ngày', () => {
  it('2 nhà thầu cùng ngày → 1 điểm, cộng đủ', () => {
    expect(sumByDate([
      { workDate: '2026-09-16', plannedHeadcount: 120, actualHeadcount: 112 },
      { workDate: '2026-09-16', plannedHeadcount: 100, actualHeadcount: 95 },
      { workDate: '2026-09-17', plannedHeadcount: 90, actualHeadcount: 82 },
    ])).toEqual([p('2026-09-16', 220, 207), p('2026-09-17', 90, 82)]);
  });
  it('đầu vào lộn xộn → kết quả luôn tăng dần theo ngày', () => {
    const out = sumByDate([
      { workDate: '2026-09-17', plannedHeadcount: 1, actualHeadcount: 1 },
      { workDate: '2026-09-16', plannedHeadcount: 2, actualHeadcount: 2 },
    ]);
    expect(out.map((x) => x.date)).toEqual(['2026-09-16', '2026-09-17']);
  });
  it('rỗng → rỗng', () => {
    expect(sumByDate([])).toEqual([]);
  });
});

describe('bucketOf - khoảng ngày của bucket', () => {
  it('tuần bắt đầu THỨ HAI (2026-09-22 là thứ Ba)', () => {
    expect(bucketOf('2026-09-22', 'week')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
  });
  it('Chủ Nhật thuộc tuần bắt đầu từ Thứ Hai TRƯỚC đó, không mở tuần mới', () => {
    expect(bucketOf('2026-09-27', 'week')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
  });
  it('tuần vắt qua ranh giới năm', () => {
    expect(bucketOf('2026-12-31', 'week')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
  });
  it('tháng = ngày 1 → ngày cuối, tháng 2 nhuận đúng 29 ngày', () => {
    expect(bucketOf('2026-09-22', 'month')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(bucketOf('2024-02-10', 'month')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });
});

describe('rangeLabel - trục X là khoảng ngày thật, KHÔNG phải "W1"', () => {
  it('định dạng dd.mm - dd.mm', () => {
    expect(rangeLabel('2026-09-21', '2026-09-27')).toBe('21.09 - 27.09');
  });
  it('vắt năm vẫn chỉ hiện ngày.tháng (năm nằm ở badge góc chart)', () => {
    expect(rangeLabel('2026-12-28', '2027-01-03')).toBe('28.12 - 03.01');
  });
});

describe('groupByBucket - mỗi điểm là SỐ NGƯỜI TRUNG BÌNH/NGÀY, không cộng dồn', () => {
  it('2 ngày 100 và 200 người → 150, KHÔNG phải 300', () => {
    const out = groupByBucket([p('2026-09-21', 100, 90), p('2026-09-22', 200, 190)], 'week');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      from: '2026-09-21', to: '2026-09-27', label: '21.09 - 27.09',
      planned: 150, actual: 140, days: 2,
    });
  });
  it('2 tuần khác nhau → 2 điểm, xếp tăng dần theo ngày', () => {
    const out = groupByBucket([p('2026-09-28', 10, 10), p('2026-09-21', 20, 20)], 'week');
    expect(out.map((x) => x.from)).toEqual(['2026-09-21', '2026-09-28']);
  });
  it('gộp theo tháng', () => {
    const out = groupByBucket([p('2026-08-31', 10, 10), p('2026-09-01', 30, 20)], 'month');
    expect(out.map((x) => x.label)).toEqual(['01.08 - 31.08', '01.09 - 30.09']);
  });
  it('làm tròn số nguyên - không có 0.5 người', () => {
    const out = groupByBucket([p('2026-09-21', 100, 100), p('2026-09-22', 101, 101)], 'week');
    expect(out[0].planned).toBe(101);
    expect(Number.isInteger(out[0].actual)).toBe(true);
  });
  it('rỗng → rỗng, không NaN và không chia cho 0', () => {
    expect(groupByBucket([], 'week')).toEqual([]);
    expect(groupByBucket([], 'month')).toEqual([]);
  });
});

describe('yearsLabel - badge năm ở góc chart', () => {
  it('cùng năm → 1 năm', () => {
    expect(yearsLabel(groupByBucket([p('2026-09-21', 1, 1)], 'week'))).toBe('2026');
  });
  it('vắt năm → "2026 - 2027"', () => {
    expect(yearsLabel(groupByBucket([p('2026-12-28', 1, 1), p('2027-01-05', 1, 1)], 'week')))
      .toBe('2026 - 2027');
  });
  it('rỗng → chuỗi rỗng (không hiện badge)', () => {
    expect(yearsLabel([])).toBe('');
  });
});
