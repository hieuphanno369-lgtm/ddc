import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { disableBackfillAction, enableBackfillAction } from '@/server/actions-backfill';
import { commitDailyImportAction, saveDailyResourcesAction } from '@/server/actions-entry';
import { commitImportAction, saveMonthlyData } from '@/server/actions';

/**
 * P4 (F3, F4): quyền bật/tắt nhập bù (chỉ admin), IDOR, luật ngày và luật tháng ở server.
 * DDC_FAKE_TODAY = 2026-09-16 (vitest.config.ts). PIC seed `pm@daidung.com.vn` được gán dự án 1, KHÔNG được gán dự án 16.
 */
const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });
const PIC = dataEntry('pm@daidung.com.vn');
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };

// Seed khoá sổ mọi tháng đã có số (2025-10..2026-08): dùng 2025-03 (chưa có số, chưa khoá) cho ca ghi được, 2026-03 cho ca khoá sổ.
const OLD_DAY = '2025-03-10';
const OLD_MONTH = '2025-03';
const LOCKED_DAY = '2026-03-10';
const LOCKED_MONTH = '2026-03';
const cell = (planned: number, actual: number) => ({
  manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: planned, actualHeadcount: actual }],
  equipment: [],
});

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

async function enable(projectId = 1, from = '2025-01-01', to = '2025-06-30') {
  login(ADMIN);
  const res = await enableBackfillAction(projectId, from, to, 'nhap bu so lich su');
  expect(res).toEqual({ ok: true });
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('enable/disableBackfillAction - chi admin (Q11)', () => {
  it.each([['data-entry PIC', PIC], ['bod', BOD], ['viewer', VIEWER], ['chua dang nhap', null]] as const)(
    '%s -> Forbidden, khong tao khoang',
    async (_label, user) => {
      login(user);
      expect(await enableBackfillAction(1, '2026-01-01', '2026-06-30', 'nhap bu so lich su')).toEqual({ ok: false, error: 'Forbidden' });
      expect(await disableBackfillAction(1)).toEqual({ ok: false, error: 'Forbidden' });
      expect(repo.listBackfillWindows(1)).toEqual([]);
    },
  );

  it('admin bat -> ghi khoang, expiresAt 30 ngay, audit_log co nguoi bat', async () => {
    await enable();
    const [w] = repo.listBackfillWindows(1);
    expect(w).toMatchObject({ projectId: 1, fromDate: '2025-01-01', toDate: '2025-06-30', enabledBy: ADMIN.email, disabledAt: null });
    const ms = new Date(w!.expiresAt!).getTime() - new Date(w!.enabledAt).getTime();
    expect(Math.round(ms / 86_400_000)).toBe(30);
    expect(repo.getAuditLog().some((a) => a.tableName === 'project_backfill_window' && a.changedBy === ADMIN.email && a.field === 'enable')).toBe(true);
  });

  it('projectId khong phai so nguyen duong -> Invalid input', async () => {
    login(ADMIN);
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(await enableBackfillAction(bad, '2026-01-01', '2026-06-30', 'nhap bu so lich su')).toEqual({ ok: false, error: 'Invalid input' });
    }
    expect(await disableBackfillAction(0)).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('du an khong ton tai -> Not found; ghi chu qua ngan -> Invalid input', async () => {
    login(ADMIN);
    expect(await enableBackfillAction(999999, '2026-01-01', '2026-06-30', 'nhap bu so lich su')).toEqual({ ok: false, error: 'Not found' });
    expect(await enableBackfillAction(1, '2026-01-01', '2026-06-30', 'abc')).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('khoang sai: to o tuong lai, from > to, ngay rac -> Invalid input; qua 24 thang -> too_long', async () => {
    login(ADMIN);
    const note = 'nhap bu so lich su';
    expect(await enableBackfillAction(1, '2026-09-01', '2026-09-17', note)).toEqual({ ok: false, error: 'Invalid input' });
    expect(await enableBackfillAction(1, '2026-06-30', '2026-01-01', note)).toEqual({ ok: false, error: 'Invalid input' });
    expect(await enableBackfillAction(1, '2026-02-30', '2026-06-30', note)).toEqual({ ok: false, error: 'Invalid input' });
    expect(await enableBackfillAction(1, '2024-01-01', '2026-09-16', note)).toEqual({ ok: false, error: 'too_long' });
    expect(repo.listBackfillWindows(1)).toEqual([]);
  });

  it('trung khoang dang bat -> overlap; tat roi bat lai duoc; tat lan 2 -> already', async () => {
    await enable();
    expect(await enableBackfillAction(1, '2025-06-01', '2025-07-31', 'nhap bu so lich su')).toEqual({ ok: false, error: 'overlap' });
    const id = repo.listBackfillWindows(1)[0]!.id;
    expect(await disableBackfillAction(id)).toEqual({ ok: true });
    expect(await disableBackfillAction(id)).toEqual({ ok: false, error: 'already' });
    expect(await enableBackfillAction(1, '2025-06-01', '2025-07-31', 'nhap bu so lich su')).toEqual({ ok: true });
    expect(await disableBackfillAction(999999)).toEqual({ ok: false, error: 'Not found' });
  });
});

describe('nhap bu SO THEO NGAY (saveDailyResourcesAction, commitDailyImportAction)', () => {
  it('PIC nhap ngay cu: chan khi chua bat; ghi duoc khi da bat; ngoai khoang van chan; audit co nhan nhap bu', async () => {
    login(PIC);
    expect(await saveDailyResourcesAction(1, OLD_DAY, cell(5, 5))).toEqual({ ok: false, error: 'out_of_window' });

    await enable();
    login(PIC);
    const ok = await saveDailyResourcesAction(1, OLD_DAY, cell(5, 5));
    expect(ok.ok).toBe(true);
    expect(await saveDailyResourcesAction(1, '2025-07-10', cell(5, 5))).toEqual({ ok: false, error: 'out_of_window' });

    const label = repo.getAuditLog().find((a) => a.field === 'backfill' && a.recordId === `1/${OLD_DAY}`);
    expect(label).toMatchObject({ changedBy: PIC.email, newValue: 'nhap bu', tableName: 'fact_daily_resources' });
  });

  it('ngay trong 7 ngay gan day khong bi gan nhan nhap bu', async () => {
    await enable();
    login(PIC);
    expect((await saveDailyResourcesAction(1, '2026-09-16', cell(3, 3))).ok).toBe(true);
    expect(repo.getAuditLog().some((a) => a.field === 'backfill')).toBe(false);
  });

  it('commitDailyImportAction: ngay cu trong khoang ghi duoc, ngoai khoang -> out_of_window va khong ghi ngay nao', async () => {
    await enable();
    login(PIC);
    const bad = await commitDailyImportAction(1, [
      { workDate: OLD_DAY, ...cell(4, 4) },
      { workDate: '2025-07-10', ...cell(4, 4) },
    ]);
    expect(bad).toEqual({ ok: false, error: 'out_of_window', workDate: '2025-07-10' });
    expect(repo.getDailyManpowerByShift(1, OLD_DAY, OLD_DAY)).toEqual([]);

    const ok = await commitDailyImportAction(1, [{ workDate: OLD_DAY, ...cell(4, 4) }]);
    expect(ok.ok).toBe(true);
  });

  it('sau khi tat -> ngay cu lai out_of_window', async () => {
    await enable();
    const id = repo.listBackfillWindows(1)[0]!.id;
    expect(await disableBackfillAction(id)).toEqual({ ok: true });
    login(PIC);
    expect(await saveDailyResourcesAction(1, OLD_DAY, cell(5, 5))).toEqual({ ok: false, error: 'out_of_window' });
  });

  it('khoang het han (expiresAt qua) -> out_of_window', async () => {
    repo.createBackfillWindow({ projectId: 1, fromDate: '2026-01-01', toDate: '2026-06-30', note: 'het han', expiresAt: new Date(Date.now() - 1000) }, ADMIN.email);
    login(PIC);
    expect(await saveDailyResourcesAction(1, OLD_DAY, cell(5, 5))).toEqual({ ok: false, error: 'out_of_window' });
  });

  it('IDOR: khoang bat cho du an 1 khong mo cua cho du an khac; PIC khong duoc gan du an 16 van Forbidden du du an do co khoang', async () => {
    await enable(1);
    await enable(16);
    login(PIC);
    expect(await saveDailyResourcesAction(16, OLD_DAY, cell(5, 5))).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('thang khoa so van chan du nam trong khoang nhap bu (Q10)', async () => {
    await enable(1, '2026-01-01', '2026-06-30');
    expect(repo.isMonthLocked(LOCKED_MONTH)).toBe(true);
    login(PIC);
    expect(await saveDailyResourcesAction(1, LOCKED_DAY, cell(5, 5))).toEqual({ ok: false, error: 'locked', month: LOCKED_MONTH });
  });

  it('admin khong can khoang nhap bu', async () => {
    login(ADMIN);
    expect((await saveDailyResourcesAction(1, OLD_DAY, cell(5, 5))).ok).toBe(true);
  });
});

describe('luat thang o server (Q9 = b): saveMonthlyData, commitImportAction', () => {
  it('PIC: thang hien tai ghi duoc; thang truoc qua cua so (chi bi khoa so seed chan); thang cu hon -> out_of_window', async () => {
    login(PIC);
    expect((await saveMonthlyData(1, '2026-09', { ac: 10 })).ok).toBe(true);
    // 2026-08 la "thang truoc": qua luat thang, chi bi khoa so cua seed chan (khong phai out_of_window).
    expect(await saveMonthlyData(1, '2026-08', { ac: 10 })).toEqual({ ok: false, error: 'locked' });
    expect(await saveMonthlyData(1, '2025-07', { ac: 10 })).toEqual({ ok: false, error: 'out_of_window' });
    expect(await saveMonthlyData(1, OLD_MONTH, { ac: 10 })).toEqual({ ok: false, error: 'out_of_window' });
  });

  it('PIC: thang tuong lai -> out_of_window', async () => {
    login(PIC);
    expect(await saveMonthlyData(1, '2026-11', { ac: 10 })).toEqual({ ok: false, error: 'out_of_window' });
  });

  it('PIC: thang cu ghi duoc khi nam trong khoang nhap bu; thang ngoai khoang van chan; audit co nhan nhap bu', async () => {
    expect(repo.isMonthLocked(OLD_MONTH)).toBe(false);
    await enable();
    login(PIC);
    expect((await saveMonthlyData(1, OLD_MONTH, { ac: 10 })).ok).toBe(true);
    expect(await saveMonthlyData(1, '2024-12', { ac: 10 })).toEqual({ ok: false, error: 'out_of_window' });
    expect(repo.getAuditLog().some((a) => a.field === 'backfill' && a.recordId === `1/${OLD_MONTH}` && a.changedBy === PIC.email)).toBe(true);
  });

  it('IDOR: khoang cua du an 1 khong cho PIC nhap thang cu cua du an khac', async () => {
    await enable(1);
    login(PIC);
    expect(await saveMonthlyData(16, OLD_MONTH, { ac: 10 })).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('thang khoa so van chan du nam trong khoang nhap bu (Q10)', async () => {
    await enable(1, '2026-01-01', '2026-06-30');
    expect(repo.isMonthLocked(LOCKED_MONTH)).toBe(true);
    login(PIC);
    expect(await saveMonthlyData(1, LOCKED_MONTH, { ac: 10 })).toEqual({ ok: false, error: 'locked' });
  });

  it('admin nhap thang cu khong can khoang nhap bu', async () => {
    login(ADMIN);
    expect((await saveMonthlyData(1, '2024-12', { ac: 10 })).ok).toBe(true);
  });

  it('commitImportAction (Excel): dong cua du an khong co khoang nhap bu bi tu choi out_of_window, du an co khoang thi ghi', async () => {
    await enable(1);
    login(PIC);
    const res = (await commitImportAction(OLD_MONTH, [{ projectId: 1, pctActual: 0.3 }])) as {
      ok: boolean; imported?: number; failed?: { projectId: number; reason: string }[];
    };
    expect(res.ok).toBe(true);
    expect(res.imported).toBe(1);
    expect(repo.getAuditLog().some((a) => a.field === 'backfill' && a.recordId === `1/${OLD_MONTH}`)).toBe(true);

    const none = (await commitImportAction('2024-12', [{ projectId: 1, pctActual: 0.3 }])) as {
      ok: boolean; imported?: number; failed?: { projectId: number; reason: string }[];
    };
    expect(none.imported).toBe(0);
    expect(none.failed).toEqual([{ projectId: 1, reason: 'out_of_window' }]);
  });

  it('commitImportAction: thang hien tai ghi binh thuong, khong nhan nhap bu', async () => {
    login(PIC);
    const res = (await commitImportAction('2026-09', [{ projectId: 1, pctActual: 0.3 }])) as { ok: boolean; imported?: number };
    expect(res.imported).toBe(1);
    expect(repo.getAuditLog().some((a) => a.field === 'backfill')).toBe(false);
  });
});
