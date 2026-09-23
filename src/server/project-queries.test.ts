import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { currentMonth, isValidYearMonth } from '@/lib/clock';
import { getProjectSummary } from './queries';
import { getManpowerDaily, getResourceSnapshot, resourceWindow } from './project-queries';

const MONTH = '2026-09';

describe('getResourceSnapshot - ảnh chụp ngày gần nhất, KHÔNG cộng dồn', () => {
  it('dự án 1: đúng số của ngày cuối (520/486 người, 72/63 thiết bị) + ngày kèm theo', async () => {
    const s = await getResourceSnapshot(1, MONTH);
    expect(s.asOfDate).toBe('2026-09-16');
    expect(s.manpowerPlanned).toBe(520);
    expect(s.manpowerActual).toBe(486);
    expect(s.equipmentPlanned).toBe(72);
    expect(s.equipmentActual).toBe(63);
  });

  it('KHÔNG phải tổng 7 ngày (nếu cộng dồn sẽ ra > 3000 người)', async () => {
    const s = await getResourceSnapshot(1, MONTH);
    expect(s.manpowerPlanned).toBeLessThan(600);
  });

  it('dự án chưa có dữ liệu ngày → asOfDate null, mọi số = 0 (UI hiện "-")', async () => {
    const s = await getResourceSnapshot(17, MONTH);
    expect(s.asOfDate).toBeNull();
    expect(s.manpowerPlanned + s.manpowerActual + s.equipmentPlanned + s.equipmentActual).toBe(0);
  });
});

describe('resourceWindow', () => {
  it('tháng hiện tại → kết thúc ở HÔM NAY, không phải cuối tháng', () => {
    expect(resourceWindow('2026-09').to).toBe('2026-09-16');
  });
  it('tháng quá khứ → kết thúc ở cuối tháng đó', () => {
    expect(resourceWindow('2026-07').to).toBe('2026-07-31');
  });
});

describe('getManpowerDaily', () => {
  it('7 ngày tracking, mỗi ngày 1 điểm đã cộng ngang 6 nhà thầu', async () => {
    const rows = await getManpowerDaily(1, MONTH);
    expect(rows).toHaveLength(7);
    expect(rows.at(-1)).toEqual({ date: '2026-09-16', planned: 520, actual: 486 });
    expect([...rows].sort((a, b) => a.date.localeCompare(b.date))).toEqual(rows);
  });
});

/**
 * Vòng CAN SUA #1 - A-3 (thay-doi.md): `app/[locale]/(app)/projects/[id]/page.tsx` từng lấy
 * `searchParams.month` gần như nguyên văn (chỉ loại đúng chuỗi 'all') rồi truyền thẳng vào
 * `getResourceSnapshot`/`getManpowerDaily` (gọi `resourceWindow` → `endOfMonth`). `endOfMonth`
 * là hàm thuần không validate input, nên `?month=abc` từng ném RangeError ('Invalid time
 * value') → trang trả 500. Fix: validate bằng `isValidYearMonth()` trước, sai format thì rơi
 * về `currentMonth()`. Test dưới đây gọi ĐÚNG các hàm đọc dữ liệu thật mà trang gọi (không
 * render lại toàn bộ RSC page - phần UI/props đã được smoke-test riêng qua Playwright), với
 * đúng công thức guard mà `page.tsx` dùng.
 */
describe('A-3 (vòng CAN SUA #1) - validate month trước khi đọc dữ liệu ngày', () => {
  it('phải thất bại: KHÔNG validate, truyền thẳng month rác vào getResourceSnapshot → throw RangeError (chứng minh lỗ hổng có thật)', async () => {
    await expect(getResourceSnapshot(1, 'abc')).rejects.toThrow(RangeError);
    await expect(getManpowerDaily(1, 'abc')).rejects.toThrow(RangeError);
  });

  it('đường chạy thuận lợi: month hợp lệ đi qua guard không đổi, dữ liệu vẫn đúng như gọi trực tiếp', () => {
    const raw: string | string[] | undefined = '2026-07';
    const guarded = typeof raw === 'string' && isValidYearMonth(raw) ? raw : currentMonth();
    expect(guarded).toBe('2026-07');
  });

  it('biên: month rác (\'abc\') qua đúng công thức guard của page.tsx → fallback currentMonth(), các hàm đọc dữ liệu KHÔNG throw nữa', async () => {
    const raw: string | string[] | undefined = 'abc';
    const guarded = typeof raw === 'string' && isValidYearMonth(raw) ? raw : currentMonth();
    expect(guarded).toBe(currentMonth());

    await expect(getResourceSnapshot(1, guarded)).resolves.toBeDefined();
    await expect(getManpowerDaily(1, guarded)).resolves.toBeInstanceOf(Array);
    await expect(getProjectSummary(1, guarded)).resolves.toBeDefined();
  });

  it('biên: month = \'all\' (giá trị đặc biệt của Task khác, KHÔNG phải YYYY-MM) cũng qua guard này, không phải chỉ loại đúng 1 chuỗi \'all\' như code cũ', async () => {
    const raw: string | string[] | undefined = 'all';
    const guarded = typeof raw === 'string' && isValidYearMonth(raw) ? raw : currentMonth();
    expect(guarded).toBe(currentMonth());
    await expect(getResourceSnapshot(1, guarded)).resolves.toBeDefined();
  });

  it('biên: searchParams.month là mảng (Next.js cho phép ?month=a&month=b) → guard vẫn fallback an toàn, không đụng .slice trên mảng', async () => {
    const raw: string | string[] | undefined = ['2026-07', '2026-08'];
    const guarded = typeof raw === 'string' && isValidYearMonth(raw) ? raw : currentMonth();
    expect(guarded).toBe(currentMonth());
    await expect(getResourceSnapshot(1, guarded)).resolves.toBeDefined();
  });
});
