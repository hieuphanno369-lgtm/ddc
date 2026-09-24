import { describe, expect, it } from 'vitest';
import type { DateRange, WeekContractorRow } from '@/server/repo/read-types';
import { buildWeeklyStack, projectTimeline, weeksInMonth, type ProjectDates } from './manpower-charts';

/**
 * Kiểm tra ĐỘC LẬP (Q3/Q4/Q5) - bổ sung các góc `manpower-charts.test.ts` của coder chưa kiểm:
 * ngày dự án dạng ISO đầy đủ có giờ (như Prisma thật trả về qua `iso()` trong `prisma-repo.ts`,
 * KHÔNG phải 'YYYY-MM-DD' đơn giản như trong test của coder), nới khoảng CẢ HAI đầu cùng lúc, và
 * vài trường hợp biên/sad-path không được coder đặt tên rõ trong kế hoạch.
 */

const NO_DATES: ProjectDates = { plannedStartDate: null, plannedFinishDate: null, actualStartDate: null, actualFinishDate: null };

describe('projectTimeline (doc lap) - dinh dang ngay ISO day du (nhu Prisma tra ve)', () => {
  it('actualStartDate/actualFinishDate dang ISO co gio (Prisma iso()) -> cat dung ve YYYY-MM-DD', () => {
    const p: ProjectDates = {
      ...NO_DATES,
      actualStartDate: '2026-09-02T00:00:00.000Z',
      actualFinishDate: '2026-09-22T00:00:00.000Z',
    };
    expect(projectTimeline(p, null)).toEqual({ from: '2026-09-02', to: '2026-09-22' });
  });

  it('mix: co actualStartDate (ISO) nhung KHONG co actualFinishDate -> rot ve plannedFinishDate (ISO)', () => {
    const p: ProjectDates = {
      plannedStartDate: '2026-01-01T00:00:00.000Z',
      plannedFinishDate: '2026-12-31T00:00:00.000Z',
      actualStartDate: '2026-09-02T00:00:00.000Z',
      actualFinishDate: null,
    };
    expect(projectTimeline(p, null)).toEqual({ from: '2026-09-02', to: '2026-12-31' });
  });

  it('noi ca 2 dau (du lieu vuot ra ngoai ca truoc lan sau ngay du an)', () => {
    const p: ProjectDates = { ...NO_DATES, actualStartDate: '2026-09-05', actualFinishDate: '2026-09-10' };
    const dataRange: DateRange = { from: '2026-08-20', to: '2026-09-25' };
    expect(projectTimeline(p, dataRange)).toEqual({ from: '2026-08-20', to: '2026-09-25' });
  });

  it('dataRange nam GON trong ngay du an -> khong noi, giu nguyen ngay du an', () => {
    const p: ProjectDates = { ...NO_DATES, actualStartDate: '2026-09-01', actualFinishDate: '2026-09-30' };
    const dataRange: DateRange = { from: '2026-09-10', to: '2026-09-15' };
    expect(projectTimeline(p, dataRange)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
});

describe('buildWeeklyStack (doc lap) - so hoc TB/ngay tren bo so khac voi test cua coder', () => {
  it('tuan du 7 ngay, 2 nha thau, TB tinh tren tong THO roi moi chia (khong cong cac so da lam tron)', () => {
    // Tuan Thu 2 08/09/2026 -> Chu nhat 14/09/2026, range trung khop dung 1 tuan.
    const rows: WeekContractorRow[] = [
      { weekStart: '2026-09-07', contractorId: 1, planned: 100, actual: 101 }, // 101/7 = 14.43 -> 14
      { weekStart: '2026-09-07', contractorId: 2, planned: 50, actual: 52 },   // 52/7 = 7.43 -> 7
    ];
    const weeks = buildWeeklyStack(rows, { from: '2026-09-07', to: '2026-09-13' });
    expect(weeks).toHaveLength(1);
    const w = weeks[0];
    expect(w.days).toBe(7);
    expect(w.actualByContractor[1]).toBe(Math.round(101 / 7));
    expect(w.actualByContractor[2]).toBe(Math.round(52 / 7));
    // actualAvg phai tinh tren TONG THO (101+52)/7, KHONG PHAI cong 2 so da lam tron (14+7).
    expect(w.actualAvg).toBe(Math.round((101 + 52) / 7));
    expect(w.plannedAvg).toBe(Math.round((100 + 50) / 7));
  });

  it('SAD PATH: range.from > range.to (du lieu goi ham sai) -> khong throw, tra mang rong (khong bay gio ao)', () => {
    const weeks = buildWeeklyStack([], { from: '2026-09-20', to: '2026-09-01' });
    expect(weeks).toEqual([]);
  });
});

describe('weeksInMonth (doc lap)', () => {
  it('thang khong giao voi timeline nao -> mang rong', () => {
    const weeks = buildWeeklyStack([], { from: '2026-09-01', to: '2026-09-07' });
    expect(weeksInMonth(weeks, '2027-01')).toEqual([]);
  });
});
