import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import { STAGE_ORDER } from '@/lib/stages';
import type { CurrentUser } from '@/lib/session';
import type { StageCode } from '@/server/repo/types';

/**
 * Hành vi then chốt của tính năng "Nhập tiến độ 7 giai đoạn + % tổng tự tính",
 * kiểm ở tầng action (saveMonthlyData) - nơi nối form ↔ repo.
 * Mock session + cache + repo barrel (như src/server/actions.test.ts).
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { commitImportAction, saveMonthlyData } from '@/server/actions';

const YM = '2026-09';
const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

/** Dựng chain đủ 7 giai đoạn theo STAGE_ORDER. */
function chain(
  pcts: number[],
  applicable: boolean[] = STAGE_ORDER.map(() => true),
): { stageCode: StageCode; pctComplete: number; applicable: boolean }[] {
  return STAGE_ORDER.map((stageCode, i) => ({ stageCode, pctComplete: pcts[i], applicable: applicable[i] }));
}

const pid = () => repo.listProjects()[0].id;

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
  (getCurrentUser as Mock).mockResolvedValue(ADMIN);
});

describe('saveMonthlyData - % tổng & khâu nghẽn tự suy từ chain', () => {
  it('%TT = tổng CÓ TRỌNG SỐ 7 giai đoạn áp dụng; bottleneckStage = giai đoạn áp dụng đầu tiên < 100%', async () => {
    const id = pid();

    const res = await saveMonthlyData(id, YM, { chain: chain([1, 0.8, 0.6, 0, 0, 0, 0]) });

    expect(res).toEqual({ ok: true });
    const fact = repo.getLatestFact(id, YM)!;
    expect(fact.pctActual).toBeCloseTo((5 * 1 + 10 * 0.8 + 10 * 0.6) / 100, 10);
    expect(fact.bottleneckStage).toBe('shop'); // design đã 100%, shop mới 80% → khâu nghẽn đầu tiên
  });

  it('giai đoạn non-applicable bị loại khỏi MẪU SỐ của %TT', async () => {
    const id = pid();

    await saveMonthlyData(id, YM, {
      chain: chain([0.5, 1.0, 0.9, 0, 0, 0, 0], [true, true, false, false, false, false, false]),
    });

    const fact = repo.getLatestFact(id, YM)!;
    // (5×0.5+10×1.0)/15, KHÔNG phải trung bình cộng 0.75
    expect(fact.pctActual).toBeCloseTo((5 * 0.5 + 10 * 1.0) / 15, 10);
    expect(fact.bottleneckStage).toBe('design');
  });

  it('0 giai đoạn áp dụng → %TT = 0, bottleneckStage = null, không NaN/không crash', async () => {
    const id = pid();

    const res = await saveMonthlyData(id, YM, {
      chain: chain([0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.9], STAGE_ORDER.map(() => false)),
    });

    expect(res).toEqual({ ok: true });
    const fact = repo.getLatestFact(id, YM)!;
    expect(fact.pctActual).toBe(0);
    expect(Number.isNaN(fact.pctActual)).toBe(false);
    expect(fact.bottleneckStage).toBeNull();
  });

  it('tất cả 100% → %TT = 1 và bottleneckStage cũ BỊ XÓA về null', async () => {
    const id = pid();
    repo.saveMonthlyFact(id, YM, { bottleneckStage: 'erection' });
    expect(repo.getLatestFact(id, YM)!.bottleneckStage).toBe('erection');

    await saveMonthlyData(id, YM, { chain: chain([1, 1, 1, 1, 1, 1, 1]) });

    const fact = repo.getLatestFact(id, YM)!;
    expect(fact.pctActual).toBeCloseTo(1, 10);
    expect(fact.bottleneckStage).toBeNull();
  });

  it('lưu chain ghi đè đúng 7 dòng của tháng - lưu lại lần 2 vẫn 7 dòng, giá trị mới nhất', async () => {
    const id = pid();

    await saveMonthlyData(id, YM, { chain: chain([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]) });
    await saveMonthlyData(id, YM, { chain: chain([0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]) });

    const vc = repo.getValueChain(id, YM);
    expect(vc).toHaveLength(7);
    expect(vc.every((v) => v.pctComplete === 0.9)).toBe(true);
  });

  it('chain có pct vượt 1.5 → server từ chối, KHÔNG ghi fact mới', async () => {
    const id = pid();
    const beforeVersion = repo.getLatestFact(id, YM)!.version;

    const res = await saveMonthlyData(id, YM, { chain: chain([2, 0, 0, 0, 0, 0, 0]) });

    expect(res.ok).toBe(false);
    expect(repo.getLatestFact(id, YM)!.version).toBe(beforeVersion);
  });

  it('chain thiếu phần tử (6 giai đoạn) → server từ chối, không crash', async () => {
    const id = pid();
    const res = await saveMonthlyData(id, YM, { chain: chain([0, 0, 0, 0, 0, 0, 0]).slice(0, 6) });
    expect(res.ok).toBe(false);
  });

  it('không phải PIC và không phải admin → Forbidden, không ghi gì', async () => {
    const id = pid();
    (getCurrentUser as Mock).mockResolvedValue({
      name: 'V',
      email: 'viewer@daidung.com.vn',
      role: 'viewer',
      canViewFinance: false,
    } satisfies CurrentUser);
    const beforeVersion = repo.getLatestFact(id, YM)!.version;

    const res = await saveMonthlyData(id, YM, { chain: chain([1, 1, 1, 1, 1, 1, 1]) });

    expect(res).toEqual({ ok: false, error: 'Forbidden' });
    expect(repo.getLatestFact(id, YM)!.version).toBe(beforeVersion);
  });

  it('cùng bộ %HT, đổi giai đoạn hoàn thành → %TT khác nhau theo trọng số (Gia công 40 >> Thiết kế 5)', async () => {
    const id = pid();

    await saveMonthlyData(id, YM, { chain: chain([1, 0, 0, 0, 0, 0, 0]) });   // chỉ Thiết kế xong
    const chiThietKe = repo.getLatestFact(id, YM)!.pctActual;

    await saveMonthlyData(id, YM, { chain: chain([0, 0, 0, 1, 0, 0, 0]) });   // chỉ Gia công xong
    const chiGiaCong = repo.getLatestFact(id, YM)!.pctActual;

    expect(chiThietKe).toBeCloseTo(0.05, 10);
    expect(chiGiaCong).toBeCloseTo(0.40, 10);
  });
});

describe('month-lock server-side - tháng đã khóa không ghi được (không chỉ chặn ở client)', () => {
  it('saveMonthlyData trên tháng đã khóa → { ok:false, error:"locked" }, KHÔNG đổi fact lẫn chuỗi giá trị', async () => {
    const id = pid();
    const beforeVersion = repo.getLatestFact(id, YM)!.version;
    const beforeChain = repo.getValueChain(id, YM).map((v) => ({ ...v }));
    repo.lockMonth(YM, ADMIN.email);

    const res = await saveMonthlyData(id, YM, { chain: chain([0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]) });

    expect(res).toEqual({ ok: false, error: 'locked' });
    expect(repo.getLatestFact(id, YM)!.version).toBe(beforeVersion);
    expect(repo.getValueChain(id, YM)).toEqual(beforeChain);
  });

  it('commitImportAction trên tháng đã khóa → { ok:false, error:"locked" }, không import', async () => {
    const id = pid();
    const before = repo.getLatestFact(id, YM)!.pctActual;
    repo.lockMonth(YM, ADMIN.email);

    const res = await commitImportAction(YM, [{ projectId: id, pctActual: 0.42 }]);

    expect(res).toEqual({ ok: false, error: 'locked' });
    expect(repo.getLatestFact(id, YM)!.pctActual).toBe(before);
  });
});

describe('không gửi chain → giữ nguyên pctActual đã import (chống footgun ghi đè)', () => {
  it('patch chỉ sửa hồ sơ (không chain) không đụng pctActual của tháng import', async () => {
    const id = pid();
    repo.saveMonthlyFact(id, YM, { pctActual: 0.42 }); // mô phỏng tháng import Excel
    const before = repo.getLatestFact(id, YM)!.pctActual;
    expect(before).toBe(0.42);

    const res = await saveMonthlyData(id, YM, { projectName: 'TÊN ĐỔI' });

    expect(res).toEqual({ ok: true });
    expect(repo.getLatestFact(id, YM)!.pctActual).toBe(0.42);
  });
});

// ---------------------------------------------------------------------------
// Vòng sửa sau CẦN SỬA - soi sâu 3 fix (month-lock / trùng stageCode / footgun)
// ---------------------------------------------------------------------------

const other = (pcts: number[]) => chain(pcts);

describe('fix #1 month-lock - khoá đúng phạm vi THÁNG, chặn cả write phụ', () => {
  it('tháng đã khoá SẴN trong seed (2026-08) → action trả "locked", không cần gọi lockMonth', async () => {
    const id = pid();
    // Seed: mọi tháng trừ 2026-09 đã có snapshotLockedAt != null.
    expect(repo.isMonthLocked('2026-08')).toBe(true);
    expect(repo.isMonthLocked(YM)).toBe(false);

    const beforeFact = { ...repo.getLatestFact(id, '2026-08')! };
    const beforeChain = repo.getValueChain(id, '2026-08').map((v) => ({ ...v }));

    const res = await saveMonthlyData(id, '2026-08', { chain: other([0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]) });

    expect(res).toEqual({ ok: false, error: 'locked' });
    expect(repo.getLatestFact(id, '2026-08')!.version).toBe(beforeFact.version);
    expect(repo.getLatestFact(id, '2026-08')!.pctActual).toBe(beforeFact.pctActual);
    expect(repo.getValueChain(id, '2026-08')).toEqual(beforeChain);
  });

  it('cùng thời điểm: 2026-08 (khoá) bị chặn, 2026-09 (chưa khoá) lưu được - lock không "khoá nhầm cả sổ"', async () => {
    const id = pid();
    const before09 = repo.getLatestFact(id, YM)!.version;

    const locked = await saveMonthlyData(id, '2026-08', { chain: other([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]) });
    const ok = await saveMonthlyData(id, YM, { chain: other([0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]) });

    expect(locked).toEqual({ ok: false, error: 'locked' });
    expect(ok).toEqual({ ok: true });
    expect(repo.getLatestFact(id, YM)!.version).toBe(before09 + 1);
  });

  it('tháng khoá: patch đổi HỒ SƠ + TÀI CHÍNH cũng bị chặn (lock short-circuit trước mọi write)', async () => {
    const id = pid();
    const beforeName = repo.getProject(id)!.projectName;
    const beforeFin = repo.getFinancial(id).length;
    repo.lockMonth(YM, ADMIN.email);

    const res = await saveMonthlyData(id, YM, {
      chain: other([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
      projectName: 'TÊN ĐỔI TRỘM',
      revenueCumulative: 999999,
    });

    expect(res).toEqual({ ok: false, error: 'locked' });
    expect(repo.getProject(id)!.projectName).toBe(beforeName);
    expect(repo.getFinancial(id).length).toBe(beforeFin);
  });

  it('commitImportAction tháng khoá: không đẩy version fact mới (mạnh hơn "pctActual giữ nguyên")', async () => {
    const id = pid();
    repo.lockMonth(YM, ADMIN.email);
    const beforeVersion = repo.getLatestFact(id, YM)!.version;

    const res = await commitImportAction(YM, [{ projectId: id, pctActual: 0.77 }]);

    expect(res).toEqual({ ok: false, error: 'locked' });
    expect(repo.getLatestFact(id, YM)!.version).toBe(beforeVersion);
  });
});

describe('fix #2 chặn trùng stageCode - action từ chối, KHÔNG ghi dở dang', () => {
  const allSame = (): { stageCode: StageCode; pctComplete: number; applicable: boolean }[] =>
    STAGE_ORDER.map(() => ({ stageCode: 'design' as StageCode, pctComplete: 0.5, applicable: true }));

  it('7× cùng stageCode → action trả ok:false và value chain giữ nguyên (không upsert 1 dòng mất 6 giai đoạn)', async () => {
    const id = pid();
    const beforeChain = repo.getValueChain(id, YM).map((v) => ({ ...v }));
    const beforeVersion = repo.getLatestFact(id, YM)!.version;

    const res = await saveMonthlyData(id, YM, { chain: allSame() });

    expect(res.ok).toBe(false);
    expect(repo.getValueChain(id, YM)).toEqual(beforeChain);
    expect(repo.getValueChain(id, YM)).toHaveLength(7);
    expect(repo.getLatestFact(id, YM)!.version).toBe(beforeVersion);
  });

  it('6 giai đoạn thật + 1 giai đoạn lặp lại → vẫn bị từ chối', async () => {
    const id = pid();
    const dup = [...chain([0, 0, 0, 0, 0, 0, 0]).slice(0, 6), { stageCode: 'design' as StageCode, pctComplete: 0, applicable: true }];

    const res = await saveMonthlyData(id, YM, { chain: dup });

    expect(res.ok).toBe(false);
  });
});

describe('fix #3 footgun chain - nhánh "không dirty" và nhánh "có dirty" đều đúng', () => {
  it('patch chỉ pctPlan (không chain) → pctPlan đổi, pctActual tháng import GIỮ NGUYÊN', async () => {
    const id = pid();
    repo.saveMonthlyFact(id, YM, { pctActual: 0.42 }); // tháng import Excel

    const res = await saveMonthlyData(id, YM, { pctPlan: 0.6 });

    expect(res).toEqual({ ok: true });
    const fact = repo.getLatestFact(id, YM)!;
    expect(fact.pctActual).toBe(0.42); // KHÔNG bị derive lại thành 0
    expect(fact.pctPlan).toBe(0.6);
  });

  it('CÓ gửi chain → pctActual derive lại (đường "dirty" của form vẫn hoạt động)', async () => {
    const id = pid();
    repo.saveMonthlyFact(id, YM, { pctActual: 0.42 });

    await saveMonthlyData(id, YM, { chain: chain([1, 1, 1, 1, 1, 1, 1]) });

    expect(repo.getLatestFact(id, YM)!.pctActual).toBe(1);
  });
});
