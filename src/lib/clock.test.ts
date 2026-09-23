import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDaysIso, addMonths, currentMonth, daysBetween, endOfMonth, historyMonths,
  isValidIsoDate, isValidYearMonth, monthOf, prevMonth, today, todayIso,
} from './clock';

const FAKE = process.env.DDC_FAKE_TODAY;
afterEach(() => {
  if (FAKE) process.env.DDC_FAKE_TODAY = FAKE; else delete process.env.DDC_FAKE_TODAY;
  vi.unstubAllEnvs();
});

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

/**
 * N-8 (danh-gia.md, vòng 2): trước fix, todayIso() đọc DDC_FAKE_TODAY ở MỌI NODE_ENV - biến này
 * lọt vào production (copy từ deploy demo, CI export, Dockerfile cũ) sẽ ghim đồng hồ đứng im
 * mãi mãi, mọi cảnh báo phạt hợp đồng theo ngày im lặng không bao giờ bắn. Test dùng
 * vi.resetModules() + import động để có state module SẠCH mỗi lần (đặc biệt cờ "đã cảnh báo 1
 * lần" - không thể test qua module import tĩnh vì nó chia sẻ state giữa các test trong cùng file).
 */
describe('clock - N-8: DDC_FAKE_TODAY bị chặn ở NODE_ENV=production', () => {
  beforeEach(() => { vi.resetModules(); });

  it('phải thất bại (oracle công thức CŨ): với code hiện tại, production KHÔNG được để override ghim đồng hồ', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.DDC_FAKE_TODAY = '2020-01-01';
    const clock = await import('./clock');
    // Nếu code cũ (không chặn) còn tồn tại thì dòng dưới sẽ ra '2020-01-01' - assertion này PHẢI
    // đúng với code MỚI (đã vá), tức chứng minh production không bị ghim theo giá trị giả.
    expect(clock.todayIso()).not.toBe('2020-01-01');
  });

  it('NODE_ENV=production + DDC_FAKE_TODAY set -> bỏ qua override, todayIso() ra ngày thật hôm nay', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.DDC_FAKE_TODAY = '2020-01-01';
    const clock = await import('./clock');
    const realToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    expect(clock.todayIso()).toBe(realToday);
  });

  it('NODE_ENV=production + DDC_FAKE_TODAY set -> console.warn ĐÚNG MỘT LẦN dù gọi todayIso() nhiều lần', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.DDC_FAKE_TODAY = '2020-01-01';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const clock = await import('./clock');

    clock.todayIso();
    clock.todayIso();
    clock.todayIso();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('DDC_FAKE_TODAY');
    warnSpy.mockRestore();
  });

  it('NODE_ENV khác production (vd "test"/"development") -> override vẫn có hiệu lực như trước, không cảnh báo', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    process.env.DDC_FAKE_TODAY = '2020-01-01';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const clock = await import('./clock');

    expect(clock.todayIso()).toBe('2020-01-01');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
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
