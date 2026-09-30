import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { currentMonth, isValidYearMonth } from '@/lib/clock';
import { repo } from '@/server/repo';
import { getProjectSummary } from './queries';
import { getManpowerDaily, getResourceBreakdown, getResourceSnapshot, getWeeklyTracking, getWorkItemComparison } from './project-queries';

// Ngày mốc (hôm nay giả lập của vitest = 2026-09-16, ngày cuối có số của dự án 1 trong seed).
const DAY = '2026-09-16';

afterEach(() => vi.restoreAllMocks());
const MONTH = '2026-09';

describe('getResourceSnapshot - ảnh chụp ngày gần nhất, KHÔNG cộng dồn', () => {
  it('dự án 1: đúng số của ngày cuối (520/486 người, 72/63 thiết bị) + ngày kèm theo', async () => {
    const s = await getResourceSnapshot(1, DAY);
    expect(s.asOfDate).toBe('2026-09-16');
    expect(s.manpowerAsOfDate).toBe('2026-09-16');
    expect(s.equipmentAsOfDate).toBe('2026-09-16');
    expect(s.manpowerPlanned).toBe(520);
    expect(s.manpowerActual).toBe(486);
    expect(s.equipmentPlanned).toBe(72);
    expect(s.equipmentActual).toBe(63);
  });

  it('KHÔNG phải tổng 7 ngày (nếu cộng dồn sẽ ra > 3000 người)', async () => {
    const s = await getResourceSnapshot(1, DAY);
    expect(s.manpowerPlanned).toBeLessThan(600);
  });

  it('dự án chưa có dữ liệu ngày → asOfDate null, mọi số = 0 (UI hiện "-")', async () => {
    const s = await getResourceSnapshot(17, DAY);
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
    vi.spyOn(repo, 'readLastDailyDate').mockImplementation(async (_id, kind) => (kind === 'manpower' ? '2026-09-16' : '2026-09-13'));
    vi.spyOn(repo, 'getDailyManpower').mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, workDate: '2026-09-16', plannedHeadcount: 100, actualHeadcount: 90 },
    ]);
    vi.spyOn(repo, 'getDailyEquipment').mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, equipmentId: 1, workDate: '2026-09-13', qtyPlanned: 10, qtyActual: 8 },
    ]);

    const s = await getResourceSnapshot(1, DAY);

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
  it('nhan luc: dem so nha thau KHAC NHAU trong dung ngay cuoi cung (repo chi tra dong cua ngay do)', async () => {
    vi.spyOn(repo, 'getDailyManpower').mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, workDate: '2026-09-16', plannedHeadcount: 5, actualHeadcount: 4 },
      { projectId: 1, contractorId: 2, workDate: '2026-09-16', plannedHeadcount: 5, actualHeadcount: 4 },
    ]);

    const s = await getResourceSnapshot(1, DAY);
    expect(s.manpowerContractors).toBe(2);
  });

  it('thiet bi: dem so nha thau KHAC NHAU (khong phai so dong) trong dung ngay cuoi', async () => {
    vi.spyOn(repo, 'getDailyEquipment').mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, equipmentId: 1, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 1 },
      { projectId: 1, contractorId: 1, equipmentId: 2, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 1 },
      { projectId: 1, contractorId: 4, equipmentId: 1, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 1 },
    ]);

    const s = await getResourceSnapshot(1, DAY);
    expect(s.equipmentContractors).toBe(2);
  });

  it('du an chua co du lieu ngay -> ca 2 bang 0', async () => {
    const s = await getResourceSnapshot(17, DAY);
    expect(s.manpowerContractors).toBe(0);
    expect(s.equipmentContractors).toBe(0);
  });
});

describe('P4 D1: nhận ngày cụ thể, bỏ cửa sổ 180 ngày (Q7 = a)', () => {
  it('số của ngày cách 200 ngày trước vẫn hiện (code cũ: cửa sổ 180 ngày nên trống)', async () => {
    const old = '2026-02-28';
    vi.spyOn(repo, 'readLastDailyDate').mockImplementation(async (_id, _kind, onOrBefore) => (onOrBefore >= old ? old : null));
    const spy = vi.spyOn(repo, 'getDailyManpower').mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, workDate: old, plannedHeadcount: 30, actualHeadcount: 25 },
    ]);
    const s = await getResourceSnapshot(1, DAY);
    expect(s.manpowerAsOfDate).toBe(old);
    expect(s.manpowerActual).toBe(25);
    // Chỉ đọc đúng 1 ngày, không quét cả khoảng dài.
    expect(spy).toHaveBeenCalledWith(1, old, old);
  });

  it('ngày chọn có số -> đúng ngày đó; trước mọi số -> trống', async () => {
    const s = await getResourceSnapshot(1, '2026-09-12');
    expect(s.manpowerAsOfDate).toBe('2026-09-12');
    const past = await getResourceSnapshot(1, '2025-01-01');
    expect(past.asOfDate).toBeNull();
  });

  it('ngày chọn chưa có số -> lấy ngày gần nhất trước đó (Q7)', async () => {
    vi.spyOn(repo, 'readLastDailyDate').mockImplementation(async (_id, _kind, onOrBefore) => (onOrBefore >= '2026-09-05' ? '2026-09-05' : null));
    const s = await getResourceSnapshot(1, '2026-09-10');
    expect(s.manpowerAsOfDate).toBe('2026-09-05');
    expect(s.equipmentAsOfDate).toBe('2026-09-05');
  });

  it('ngày rác, không tồn tại hoặc ở tương lai -> hôm nay, không throw', async () => {
    for (const bad of ['abc', '2026-02-30', '9999-12-31', '']) {
      const s = await getResourceSnapshot(1, bad);
      expect(s.manpowerAsOfDate).toBe('2026-09-16');
    }
  });
});

describe('getResourceBreakdown - "Nhan luc theo nha thau" / "Thiet bi theo nhom"', () => {
  it('du an 1 ngay 16/09: 6 nha thau, tong 520/486, dong dau la KH lon nhat', async () => {
    const r = await getResourceBreakdown(1, DAY);
    expect(r.manpowerAsOfDate).toBe('2026-09-16');
    expect(r.manpower).toHaveLength(6);
    expect(r.manpower[0]).toEqual({ id: 1, name: 'Nhà thầu Lắp dựng A', note: 'Lắp dựng kết cấu chính', planned: 120, actual: 112 });
    expect(r.manpower.reduce((s, x) => s + x.planned, 0)).toBe(520);
    expect(r.manpower.reduce((s, x) => s + x.actual, 0)).toBe(486);
  });
  it('thiet bi gop theo nhom, cong NGANG nha thau dung chung: TB1 = 14/12 cua NT1+NT2+NT3', async () => {
    const r = await getResourceBreakdown(1, DAY);
    expect(r.equipmentAsOfDate).toBe('2026-09-16');
    expect(r.equipment).toHaveLength(7);
    expect(r.equipment[0]).toEqual({ id: 1, name: 'Cẩu bánh xích', note: 'Nhà thầu Lắp dựng A, Nhà thầu Lắp dựng B, Nhà thầu Cơ khí C', planned: 14, actual: 12 });
    expect(r.equipment.reduce((s, x) => s + x.planned, 0)).toBe(72);
    expect(r.equipment.reduce((s, x) => s + x.actual, 0)).toBe(63);
  });
  it('hoa KH thi xep theo ten (vi): "Giàn giáo di động" (8) truoc "Xe tải chuyên dụng" (8)', async () => {
    const r = await getResourceBreakdown(1, DAY);
    expect(r.equipment.slice(5).map((x) => x.id)).toEqual([7, 6]);
  });
  it('du an chua co du lieu ngay -> mang rong, ngay null', async () => {
    expect(await getResourceBreakdown(17, DAY)).toEqual({ manpowerAsOfDate: null, equipmentAsOfDate: null, manpower: [], equipment: [] });
  });
  it('nha thau/thiet bi khong con trong dim -> ten "#id", khong crash', async () => {
    vi.spyOn(repo, 'getDailyManpower').mockResolvedValueOnce([{ projectId: 1, contractorId: 99, workDate: '2026-09-16', plannedHeadcount: 3, actualHeadcount: 2 }]);
    vi.spyOn(repo, 'getDailyEquipment').mockResolvedValueOnce([{ projectId: 1, contractorId: 99, equipmentId: 98, workDate: '2026-09-16', qtyPlanned: 1, qtyActual: 1 }]);
    const r = await getResourceBreakdown(1, DAY);
    expect(r.manpower[0].name).toBe('#99');
    expect(r.equipment[0]).toMatchObject({ name: '#98', note: '#99' });
  });
});

describe('getWeeklyTracking - 7 ngay tracking + nha thau/thiet bi xuat hien trong tuan', () => {
  it('du an 1: 7 ngay lien tiep ket thuc 16/09, du 6 nha thau + 7 thiet bi', async () => {
    const w = await getWeeklyTracking(1, DAY);
    expect(w).not.toBeNull();
    expect(w!.days).toEqual(['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16']);
    expect(w!.today).toBe('2026-09-16');
    expect(w!.contractors.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(w!.equipments.map((e) => e.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(w!.manpower).toHaveLength(42);
    expect(w!.equipmentUsage).toHaveLength(70);
  });

  it('du an 17 (chua co so lieu) -> null', async () => {
    expect(await getWeeklyTracking(17, DAY)).toBeNull();
  });

  it('ngay cuoi = ngay cuoi CO so lieu (nhan luc hoac thiet bi), khong phai hom nay', async () => {
    vi.spyOn(repo, 'readLastDailyDate').mockImplementation(async (_id, kind) => (kind === 'manpower' ? '2026-09-12' : '2026-09-14'));
    vi.spyOn(repo, 'getDailyManpower').mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, workDate: '2026-09-12', plannedHeadcount: 10, actualHeadcount: 9 },
    ]);
    vi.spyOn(repo, 'getDailyEquipment').mockResolvedValueOnce([
      { projectId: 1, contractorId: 1, equipmentId: 1, workDate: '2026-09-14', qtyPlanned: 1, qtyActual: 1 },
    ]);
    const w = await getWeeklyTracking(1, DAY);
    expect(w!.days.at(-1)).toBe('2026-09-14');
  });

  it('nha thau khong con trong danh sach nhung co so lieu -> hien "#id", nam SAU cac nha thau da gan', async () => {
    vi.spyOn(repo, 'getDailyManpower').mockResolvedValueOnce([
      { projectId: 1, contractorId: 99, workDate: '2026-09-16', plannedHeadcount: 3, actualHeadcount: 2 },
    ]);
    const w = await getWeeklyTracking(1, DAY);
    expect(w!.contractors.at(-1)).toEqual({ id: 99, name: '#99', scopeOfWork: '' });
  });
});

describe('P4 D1: getWeeklyTracking theo ngày chọn', () => {
  it('chọn 12/09 -> 7 ngày kết thúc 12/09 (06/09 - 12/09)', async () => {
    const w = await getWeeklyTracking(1, '2026-09-12');
    expect(w!.days[0]).toBe('2026-09-06');
    expect(w!.days.at(-1)).toBe('2026-09-12');
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
    const rows = await getManpowerDaily(1, '2026-09-10', '2026-09-16');
    expect(rows).toHaveLength(7);
    expect(rows.at(-1)).toEqual({ date: '2026-09-16', planned: 520, actual: 486 });
    expect([...rows].sort((a, b) => a.date.localeCompare(b.date))).toEqual(rows);
  });
});

/**
 * A-3 / N-3 (danh-gia.md): tham số thời gian từ URL không được làm trang trả 500. Nay hàm nhận ngày cụ thể
 * và tự validate (safeDay): rác, ngày không tồn tại, năm tràn số, ngày tương lai đều rơi về hôm nay.
 */
describe('A-3 / N-3 - validate ngày/tháng trước khi đọc dữ liệu', () => {
  it('getResourceSnapshot / getResourceBreakdown / getWeeklyTracking với ngày rác không throw', async () => {
    for (const bad of ['abc', '2026-02-30', '9999-12-31', '2026-13-01']) {
      await expect(getResourceSnapshot(1, bad)).resolves.toBeDefined();
      await expect(getResourceBreakdown(1, bad)).resolves.toBeDefined();
      await expect(getWeeklyTracking(1, bad)).resolves.toBeDefined();
    }
  });

  it('getManpowerDaily với from/to rác không throw, đảo chỗ nếu from > to', async () => {
    await expect(getManpowerDaily(1, 'abc', '9999-99-99')).resolves.toBeInstanceOf(Array);
    const rows = await getManpowerDaily(1, '2026-09-16', '2026-09-10');
    expect(rows).toHaveLength(7);
  });

  it('month rác qua guard vẫn fallback currentMonth, getProjectSummary không throw', async () => {
    const guarded = isValidYearMonth('abc') ? 'abc' : currentMonth();
    expect(guarded).toBe(currentMonth());
    await expect(getProjectSummary(1, guarded)).resolves.toBeDefined();
    expect(isValidYearMonth('9999-12')).toBe(false);
  });
});
