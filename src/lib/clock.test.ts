import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addDaysIso, addMonths, currentMonth, daysBetween, endOfMonth, historyMonths,
  isValidIsoDate, isValidYearMonth, monthOf, prevMonth, today, todayIso,
} from './clock';

const FAKE = process.env.DDC_FAKE_TODAY;
afterEach(() => { if (FAKE) process.env.DDC_FAKE_TODAY = FAKE; else delete process.env.DDC_FAKE_TODAY; });

describe('clock - DDC_FAKE_TODAY ghi đè được (demo giữ dữ liệu seed 09/2026)', () => {
  it('đặt DDC_FAKE_TODAY → today()/currentMonth() bám theo', () => {
    process.env.DDC_FAKE_TODAY = '2026-09-16';
    expect(todayIso()).toBe('2026-09-16');
    expect(today().toISOString()).toBe('2026-09-16T00:00:00.000Z');
    expect(currentMonth()).toBe('2026-09');
  });

  it('DDC_FAKE_TODAY rác → bỏ qua, rơi về đồng hồ thật (không crash)', () => {
    process.env.DDC_FAKE_TODAY = 'khong-phai-ngay';
    expect(isValidIsoDate(todayIso())).toBe(true);
    expect(isValidYearMonth(currentMonth())).toBe(true);
  });

  it('today() trả Date MỚI mỗi lần gọi - không chia sẻ object mutable', () => {
    process.env.DDC_FAKE_TODAY = '2026-09-16';
    const a = today();
    a.setUTCFullYear(1999);
    expect(today().getUTCFullYear()).toBe(2026);
  });
});

describe('clock - số học tháng', () => {
  it('addMonths qua ranh giới năm cả hai chiều', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-09', 0)).toBe('2026-09');
    expect(addMonths('2025-10', 15)).toBe('2027-01');
  });
  it('prevMonth = addMonths(-1)', () => {
    expect(prevMonth('2026-01')).toBe('2025-12');
  });
  it('monthOf cắt đúng YYYY-MM theo UTC', () => {
    expect(monthOf(new Date('2026-09-16T00:00:00Z'))).toBe('2026-09');
  });
  it('endOfMonth: 30/31 ngày, tháng 2 thường và tháng 2 nhuận', () => {
    expect(endOfMonth('2026-09')).toBe('2026-09-30');
    expect(endOfMonth('2026-01')).toBe('2026-01-31');
    expect(endOfMonth('2026-02')).toBe('2026-02-28');
    expect(endOfMonth('2024-02')).toBe('2024-02-29');
    expect(endOfMonth('2026-12')).toBe('2026-12-31');
  });
  it('endOfMonth KHÔNG đọc đồng hồ - đổi DDC_FAKE_TODAY không ảnh hưởng (seed gọi được)', () => {
    process.env.DDC_FAKE_TODAY = '2030-01-01';
    expect(endOfMonth('2026-09')).toBe('2026-09-30');
  });
});

describe('clock - historyMonths', () => {
  beforeEach(() => { process.env.DDC_FAKE_TODAY = '2026-09-16'; });

  it('mặc định 12 tháng, cũ → mới, phần tử cuối = tháng hiện tại', () => {
    const ms = historyMonths();
    expect(ms).toHaveLength(12);
    expect(ms[0]).toBe('2025-10');
    expect(ms[11]).toBe('2026-09');
    expect([...ms].sort()).toEqual(ms);
  });
  it('count = 1 → chỉ tháng hiện tại; count <= 0 → mảng rỗng (không vòng lặp âm)', () => {
    expect(historyMonths(1)).toEqual(['2026-09']);
    expect(historyMonths(0)).toEqual([]);
    expect(historyMonths(-3)).toEqual([]);
  });
});

describe('clock - số học ngày', () => {
  it('addDaysIso qua ranh giới tháng/năm', () => {
    expect(addDaysIso('2026-09-22', -6)).toBe('2026-09-16');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('daysBetween có dấu, cùng ngày = 0', () => {
    expect(daysBetween('2026-09-16', '2026-09-22')).toBe(6);
    expect(daysBetween('2026-09-22', '2026-09-22')).toBe(0);
    expect(daysBetween('2026-09-22', '2026-09-16')).toBe(-6);
  });
});
