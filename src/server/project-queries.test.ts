import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

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
