import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { currentMonth, isValidYearMonth } from '@/lib/clock';
import { repo } from '@/server/repo';
import { getProjectSummary } from './queries';
import { getManpowerDaily, getResourceBreakdown, getResourceSnapshot, getWeeklyTracking, getWorkItemComparison, resourceWindow } from './project-queries';

const MONTH = '2026-09';

describe('getResourceSnapshot - ảnh chụp ngày gần nhất, KHÔNG cộng dồn', () => {
  it('dự án 1: đúng số của ngày cuối (520/486 người, 72/63 thiết bị) + ngày kèm theo', async () => {
    const s = await getResourceSnapshot(1, MONTH);
    expect(s.asOfDate).toBe('2026-09-16');
    expect(s.manpowerAsOfDate).toBe('2026-09-16');
    expect(s.equipmentAsOfDate).toBe('2026-09-16');
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
    expect(s.manpowerAsOfDate).toBeNull();
    expect(s.equipmentAsOfDate).toBeNull();
    expect(s.manpowerPlanned + s.manpowerActual + s.equipmentPlanned + s.equipmentActual).toBe(0);
  });
});

/**
 * N-6 (danh-gia.md, vòng 2): nhân lực và thiết bị có thể nhập lệch ngày (nhân lực tới 16/09,
 * thiết bị dừng ở 13/09 chẳng hạn). asOfDate CŨ = ngày MỚI HƠN trong 2 ngày - nếu dùng chung 1
 * nhãn cho cả 2 card, card có dữ liệu CŨ HƠN sẽ hiện nhầm ngày của card kia (số của 13/09 nhưng
 * ghi "16/09"). Test giả lập lệch ngày bằng cách mock 2 hàm đọc dữ liệu ngày của repo.
 */
describe('getResourceSnapshot - N-6: nhân lực và thiết bị lệch ngày nhập', () => {
  it('nhân lực tới 16/09, thiết bị dừng ở 13/09 -> mỗi bên trả ĐÚNG ngày của chính nó, không dùng chung asOfDate', async () => {
    vi.spyOn(repo, 'getDailyManpower').mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, workDate: '2026-09-16', plannedHeadcount: 100, actualHeadcount: 90 },
    ]);
    vi.spyOn(repo, 'getDailyEquipment').mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, equipmentId: 1, workDate: '2026-09-13', qtyPlanned: 10, qtyActual: 8 },
    ]);

    const s = await getResourceSnapshot(1, MONTH);

    expect(s.manpowerAsOfDate).toBe('2026-09-16');
    expect(s.equipmentAsOfDate).toBe('2026-09-13');
    // asOfDate (nhãn chung, KHÔNG dùng cho card riêng nữa) vẫn là ngày mới hơn - chứng minh 2 ngày
    // thật sự khác nhau trong kịch bản này, không phải test vô hại.
    expect(s.asOfDate).toBe('2026-09-16');
    expect(s.manpowerActual).toBe(90);
    expect(s.equipmentActual).toBe(8);
  });
});

describe('getResourceSnapshot - manpowerContractors/equipmentContractors (P1B Task 1, the A)', () => {
  it('nhan luc: dem so nha thau KHAC NHAU trong dung ngay cuoi cung (bo qua ngay truoc)', async () => {
    vi.spyOn(repo, 'getDailyManpower').mockResolvedValueOnce([
      { projectId: 1, contractorId: 3, workDate: '2026-09-15', plannedHeadcount: 10, actualHeadcount: 9 },
      { projectId: 1, contractorId: 1, workDate: '2026-09-16', plannedHeadcount: 5, actualHeadcount: 4 },
      { projectId: 1, contractorId: 2, workDate: '2026-09-16', plannedHeadcount: 5, actualHeadcount: 4 },
    ]);

    const s = await getResourceSnapshot(1, MONTH);
    expect(s.manpowerContractors).toBe(2);
  });

  it('thiet bi: dem so nha thau KHAC NHAU (khong phai so dong) trong dung ngay cuoi', async () => {
    vi.spyOn(repo, 'getDailyEquipment').mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, equipmentId: 1, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 1 },
      { projectId: 1, contractorId: 1, equipmentId: 2, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 1 },
      { projectId: 1, contractorId: 4, equipmentId: 1, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 1 },
    ]);

    const s = await getResourceSnapshot(1, MONTH);
    expect(s.equipmentContractors).toBe(2);
  });

  it('du an chua co du lieu ngay -> ca 2 bang 0', async () => {
    const s = await getResourceSnapshot(17, MONTH);
    expect(s.manpowerContractors).toBe(0);
    expect(s.equipmentContractors).toBe(0);
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

describe('getResourceBreakdown - "Nhan luc theo nha thau" / "Thiet bi theo nhom"', () => {
  it('du an 1 ngay 16/09: 6 nha thau, tong 520/486, dong dau la KH lon nhat', async () => {
    const r = await getResourceBreakdown(1, MONTH);
    expect(r.manpowerAsOfDate).toBe('2026-09-16');
    expect(r.manpower).toHaveLength(6);
    expect(r.manpower[0]).toEqual({ id: 1, name: 'Nhà thầu Lắp dựng A', note: 'Lắp dựng kết cấu chính', planned: 120, actual: 112 });
    expect(r.manpower.reduce((s, x) => s + x.planned, 0)).toBe(520);
    expect(r.manpower.reduce((s, x) => s + x.actual, 0)).toBe(486);
  });
  it('thiet bi gop theo nhom, cong NGANG nha thau dung chung: TB1 = 14/12 cua NT1+NT2+NT3', async () => {
    const r = await getResourceBreakdown(1, MONTH);
    expect(r.equipmentAsOfDate).toBe('2026-09-16');
    expect(r.equipment).toHaveLength(7);
    expect(r.equipment[0]).toEqual({ id: 1, name: 'Cẩu bánh xích', note: 'Nhà thầu Lắp dựng A, Nhà thầu Lắp dựng B, Nhà thầu Cơ khí C', planned: 14, actual: 12 });
    expect(r.equipment.reduce((s, x) => s + x.planned, 0)).toBe(72);
    expect(r.equipment.reduce((s, x) => s + x.actual, 0)).toBe(63);
  });
  it('hoa KH thi xep theo ten (vi): "Giàn giáo di động" (8) truoc "Xe tải chuyên dụng" (8)', async () => {
    const r = await getResourceBreakdown(1, MONTH);
    expect(r.equipment.slice(5).map((x) => x.id)).toEqual([7, 6]);
  });
  it('du an chua co du lieu ngay -> mang rong, ngay null', async () => {
    expect(await getResourceBreakdown(17, MONTH)).toEqual({ manpowerAsOfDate: null, equipmentAsOfDate: null, manpower: [], equipment: [] });
  });
  it('nha thau/thiet bi khong con trong dim -> ten "#id", khong crash', async () => {
    vi.spyOn(repo, 'getDailyManpower').mockResolvedValueOnce([{ projectId: 1, contractorId: 99, workDate: '2026-09-16', plannedHeadcount: 3, actualHeadcount: 2 }]);
    vi.spyOn(repo, 'getDailyEquipment').mockResolvedValueOnce([{ projectId: 1, contractorId: 99, equipmentId: 98, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 1 }]);
    const r = await getResourceBreakdown(1, MONTH);
    expect(r.manpower[0].name).toBe('#99');
    expect(r.equipment[0]).toMatchObject({ name: '#98', note: '#99' });
  });
});

describe('getWeeklyTracking - 7 ngay tracking + nha thau/thiet bi xuat hien trong tuan', () => {
  it('du an 1: 7 ngay lien tiep ket thuc 16/09, du 6 nha thau + 7 thiet bi', async () => {
    const w = await getWeeklyTracking(1, MONTH);
    expect(w).not.toBeNull();
    expect(w!.days).toEqual(['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16']);
    expect(w!.today).toBe('2026-09-16');
    expect(w!.contractors.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(w!.equipments.map((e) => e.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(w!.manpower).toHaveLength(42);
    expect(w!.equipmentUsage).toHaveLength(70);
  });

  it('du an 17 (chua co so lieu) -> null', async () => {
    expect(await getWeeklyTracking(17, MONTH)).toBeNull();
  });

  it('ngay cuoi = ngay cuoi CO so lieu (nhan luc hoac thiet bi), khong phai hom nay', async () => {
    vi.spyOn(repo, 'getDailyManpower').mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, workDate: '2026-09-12', plannedHeadcount: 10, actualHeadcount: 9 },
    ]);
    vi.spyOn(repo, 'getDailyEquipment').mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, equipmentId: 1, workDate: '2026-09-14', qtyPlanned: 1, qtyActual: 1 },
    ]);
    const w = await getWeeklyTracking(1, MONTH);
    expect(w!.days.at(-1)).toBe('2026-09-14');
  });

  it('nha thau khong con trong danh sach nhung co so lieu -> hien "#id", nam SAU cac nha thau da gan', async () => {
    vi.spyOn(repo, 'getDailyManpower').mockResolvedValueOnce([
      { projectId: 1, contractorId: 99, workDate: '2026-09-16', plannedHeadcount: 3, actualHeadcount: 2 },
    ]);
    const w = await getWeeklyTracking(1, MONTH);
    expect(w!.contractors.at(-1)).toEqual({ id: 99, name: '#99', scopeOfWork: '' });
  });
});

describe('getWorkItemComparison - KH/TT theo hang muc cho giai doan DINH LUONG', () => {
  it('du an 1: fabrication dai 10, dung so phan tu dau; shop dai 10; design/handover khong co', async () => {
    const r = await getWorkItemComparison(1, MONTH);
    expect(r.fabrication).toHaveLength(10);
    expect(r.fabrication![0]).toEqual({ workItemId: 1, name: 'Hệ giàn nâng', planned: 4828, actual: 3814 });
    expect(r.shop).toHaveLength(10);
    expect(r.design).toBeUndefined();
    expect(r.handover).toBeUndefined();
  });

  it('du an chua co du lieu -> object rong', async () => {
    expect(await getWorkItemComparison(17, MONTH)).toEqual({});
  });

  it('month rac khong throw', async () => {
    await expect(getWorkItemComparison(1, 'abc')).resolves.toBeDefined();
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
  it('N-3 (vòng 2, danh-gia.md): sau khi thêm guard NGAY TRONG resourceWindow(), gọi thẳng getResourceSnapshot("abc") KHÔNG CẦN qua page.tsx cũng không còn throw - lỗ hổng ở TẦNG NÀY đã đóng, không chỉ chặn ở page', async () => {
    await expect(getResourceSnapshot(1, 'abc')).resolves.toBeDefined();
    await expect(getManpowerDaily(1, 'abc')).resolves.toBeInstanceOf(Array);
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

/**
 * N-3 (danh-gia.md, vòng 2 - sổ nợ kỹ thuật): '9999-12' ĐÚNG format 'YYYY-MM' (khớp regex cũ)
 * nên guard kiểu A-3 (chỉ check isValidYearMonth) không chặn được nó - addMonths('9999-12', 1)
 * tràn sang năm 5 chữ số ('10000-01'), new Date(...) không parse được, endOfMonth() ném
 * RangeError('Invalid time value') → trang vẫn trả 500 dù đã có fix A-3.
 * Vá: isValidYearMonth() (clock.ts) giờ bound thêm năm 1900-2999, không chỉ check format.
 */
describe('N-3 - yearMonth đúng format nhưng năm tràn số (\'9999-12\')', () => {
  it('phải thất bại (oracle công thức CŨ - chỉ check format): "9999-12" khớp regex /^\\d{4}-(0[1-9]|1[0-2])$/, chứng minh lỗ hổng có thật nếu guard chỉ dừng ở check format', () => {
    const OLD_FORMAT_ONLY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
    expect(OLD_FORMAT_ONLY_RE.test('9999-12')).toBe(true);
  });

  it('isValidYearMonth("9999-12") phải là false (năm ngoài miền 1900-2999), không chỉ check format', () => {
    expect(isValidYearMonth('9999-12')).toBe(false);
  });

  it('resourceWindow("9999-12") không còn throw RangeError - fallback về currentMonth()', () => {
    expect(() => resourceWindow('9999-12')).not.toThrow();
    expect(resourceWindow('9999-12')).toEqual(resourceWindow(currentMonth()));
  });

  it('getResourceSnapshot/getManpowerDaily với "9999-12" không throw, trả dữ liệu như tháng hiện tại', async () => {
    await expect(getResourceSnapshot(1, '9999-12')).resolves.toBeDefined();
    await expect(getManpowerDaily(1, '9999-12')).resolves.toBeInstanceOf(Array);
  });
});
