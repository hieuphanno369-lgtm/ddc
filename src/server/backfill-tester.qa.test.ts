import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as XLSX from 'xlsx';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';
import { buildDailyTemplate } from '@/server/daily-import';
import viMessages from '@/i18n/messages/vi.json';
import enMessages from '@/i18n/messages/en.json';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { disableBackfillAction, enableBackfillAction } from '@/server/actions-backfill';
import { commitDailyImportAction, previewDailyImportAction, saveDailyResourcesAction } from '@/server/actions-entry';
import { commitImportAction, importExcelAction, saveMonthlyData } from '@/server/actions';

/**
 * P4 nhom F - tester (doc lap voi coder, khung `actions-backfill.test.ts`).
 * Dong ho ghim DDC_FAKE_TODAY = 2026-09-16 (vitest.config.ts): today-7 = 2026-09-09, max = today + 30 = 2026-10-16.
 * Seed khoa so 2025-10..2026-08. pm@daidung.com.vn la PIC/Backup du an 1,2,3,5,7,11, KHONG duoc gan du an 16.
 * Ngay/thang 2025-01..2025-06 chua co so va chua khoa nen dung cho ca ghi duoc.
 */
const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });
const PIC = dataEntry('pm@daidung.com.vn');
const STRANGER = dataEntry('nguoi-la@daidung.com.vn');
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const NOTE = 'nhap bu lich su test';
const cell = (planned = 5, actual = 5) => ({
  manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: planned, actualHeadcount: actual }],
  equipment: [],
});

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

async function enable(projectId: number, from: string, to: string) {
  login(ADMIN);
  const res = await enableBackfillAction(projectId, from, to, NOTE);
  expect(res).toEqual({ ok: true });
}

const actions = () => repo.getActivity().map((a) => a.action);

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('QUYEN va IDOR tren ca 4 duong ghi (viewer, bod, khach, data-entry khong duoc gan)', () => {
  beforeEach(async () => {
    await enable(1, '2025-01-01', '2025-06-30');
  });

  it.each([
    ['viewer', VIEWER],
    ['bod', BOD],
    ['chua dang nhap', null],
    ['data-entry khong duoc gan du an 1', STRANGER],
  ] as const)('%s: luu ngay, luu thang, commit Excel ngay -> Forbidden, khong ghi gi', async (_l, user) => {
    login(user);
    expect(await saveDailyResourcesAction(1, '2025-03-10', cell())).toEqual({ ok: false, error: 'Forbidden' });
    expect(await saveMonthlyData(1, '2025-03', { ac: 10 })).toEqual({ ok: false, error: 'Forbidden' });
    expect(await commitDailyImportAction(1, [{ workDate: '2025-03-10', ...cell() }])).toEqual({ ok: false, error: 'Forbidden' });
    expect(repo.getDailyManpowerByShift(1, '2025-03-10', '2025-03-10')).toEqual([]);
    expect(repo.getAuditLog().filter((a) => a.field === 'backfill')).toEqual([]);
    expect(actions().filter((a) => a.endsWith('_backfill'))).toEqual([]);
  });

  it.each([
    ['viewer', VIEWER],
    ['bod', BOD],
    ['chua dang nhap', null],
  ] as const)('%s: commit Excel thang -> Forbidden', async (_l, user) => {
    login(user);
    expect(await commitImportAction('2025-03', [{ projectId: 1, pctActual: 0.3 }])).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('data-entry khong duoc gan: commit Excel thang -> khong ghi, failed not_assigned (khong lo ton tai du an)', async () => {
    login(STRANGER);
    const res = (await commitImportAction('2025-03', [{ projectId: 1, pctActual: 0.3 }])) as {
      ok: boolean; imported: number; failed: { projectId: number; reason: string }[];
    };
    expect(res.imported).toBe(0);
    expect(res.failed).toEqual([{ projectId: 1, reason: 'not_assigned' }]);
    expect(repo.getAuditLog().filter((a) => a.field === 'backfill')).toEqual([]);
  });

  it('khoang cua du an 1 KHONG mo cho du an 16 (PIC khong duoc gan 16): ca 4 duong', async () => {
    await enable(16, '2025-01-01', '2025-06-30');
    login(PIC);
    expect(await saveDailyResourcesAction(16, '2025-03-10', cell())).toEqual({ ok: false, error: 'Forbidden' });
    expect(await saveMonthlyData(16, '2025-03', { ac: 10 })).toEqual({ ok: false, error: 'Forbidden' });
    expect(await commitDailyImportAction(16, [{ workDate: '2025-03-10', ...cell() }])).toEqual({ ok: false, error: 'Forbidden' });
    const res = (await commitImportAction('2025-03', [{ projectId: 16, pctActual: 0.3 }, { projectId: 1, pctActual: 0.3 }])) as {
      imported: number; failed: { projectId: number; reason: string }[];
    };
    expect(res.imported).toBe(1);
    expect(res.failed).toEqual([{ projectId: 16, reason: 'not_assigned' }]);
  });

  it('projectId la (999999, 0, -1, 1.5, NaN) tren luu ngay/thang: khong ghi, khong nem loi', async () => {
    login(PIC);
    for (const bad of [999999, 0, -1, 1.5, Number.NaN]) {
      const d = await saveDailyResourcesAction(bad, '2025-03-10', cell());
      expect(d.ok).toBe(false);
      const m = await saveMonthlyData(bad, '2025-03', { ac: 10 });
      expect(m.ok).toBe(false);
    }
  });

  it('PIC duoc gan CA du an 1 (co khoang) VA du an 2 (khong co khoang): du an 2 van out_of_window', async () => {
    expect(repo.getAssignmentsForUser(PIC.email)).toEqual(expect.arrayContaining([1, 2]));
    login(PIC);
    expect(await saveDailyResourcesAction(2, '2025-03-10', cell())).toEqual({ ok: false, error: 'out_of_window' });
    expect(await saveMonthlyData(2, '2025-03', { ac: 10 })).toEqual({ ok: false, error: 'out_of_window' });
    expect(await commitDailyImportAction(2, [{ workDate: '2025-03-10', ...cell() }])).toEqual({ ok: false, error: 'out_of_window', workDate: '2025-03-10' });
    const res = (await commitImportAction('2025-03', [{ projectId: 1, pctActual: 0.3 }, { projectId: 2, pctActual: 0.3 }])) as {
      imported: number; failed: { projectId: number; reason: string }[];
    };
    expect(res.imported).toBe(1);
    expect(res.failed).toEqual([{ projectId: 2, reason: 'out_of_window' }]);
  });

  it('data-entry KHONG the tu bat/tat nhap bu bang cach goi thang action (Forbidden), du co khoang', async () => {
    login(PIC);
    expect(await enableBackfillAction(2, '2025-01-01', '2025-06-30', NOTE)).toEqual({ ok: false, error: 'Forbidden' });
    const id = repo.listBackfillWindows(1)[0]!.id;
    expect(await disableBackfillAction(id)).toEqual({ ok: false, error: 'Forbidden' });
    expect(repo.listBackfillWindows(2)).toEqual([]);
    expect(repo.listBackfillWindows(1)[0]!.disabledAt).toBeNull();
  });
});

describe('BIEN NGAY (saveDailyResourcesAction) quanh khoang 2025-01-10..2025-01-20', () => {
  beforeEach(async () => {
    await enable(1, '2025-01-10', '2025-01-20');
    login(PIC);
  });

  it.each([
    ['ngay truoc from', '2025-01-09', false],
    ['dung from', '2025-01-10', true],
    ['giua khoang', '2025-01-15', true],
    ['dung to', '2025-01-20', true],
    ['hom sau to', '2025-01-21', false],
  ] as const)('%s (%s) -> %s', async (_l, day, allowed) => {
    const res = await saveDailyResourcesAction(1, day, cell());
    if (allowed) expect(res.ok).toBe(true);
    else expect(res).toEqual({ ok: false, error: 'out_of_window' });
  });

  it('khoang 1 ngay (from = to): chi ngay do mo', async () => {
    login(ADMIN);
    expect(await enableBackfillAction(1, '2025-02-05', '2025-02-05', NOTE)).toEqual({ ok: true });
    login(PIC);
    expect((await saveDailyResourcesAction(1, '2025-02-05', cell())).ok).toBe(true);
    expect(await saveDailyResourcesAction(1, '2025-02-04', cell())).toEqual({ ok: false, error: 'out_of_window' });
    expect(await saveDailyResourcesAction(1, '2025-02-06', cell())).toEqual({ ok: false, error: 'out_of_window' });
  });

  it('2 khoang roi nhau: ngay o giua 2 khoang bi chan', async () => {
    login(ADMIN);
    await enableBackfillAction(1, '2025-03-01', '2025-03-03', NOTE);
    await enableBackfillAction(1, '2025-03-10', '2025-03-12', NOTE);
    login(PIC);
    expect((await saveDailyResourcesAction(1, '2025-03-02', cell())).ok).toBe(true);
    expect((await saveDailyResourcesAction(1, '2025-03-11', cell())).ok).toBe(true);
    expect(await saveDailyResourcesAction(1, '2025-03-06', cell())).toEqual({ ok: false, error: 'out_of_window' });
  });

  it('ngay rac / sai dinh dang -> Invalid input, khong ghi', async () => {
    for (const bad of ['', '2025-02-30', '2025-13-01', '10/01/2025', '2025-1-10', 'abc', '2025-01-10T00:00:00Z']) {
      const res = await saveDailyResourcesAction(1, bad, cell());
      expect(res.ok, bad).toBe(false);
    }
    expect(repo.getAuditLog().filter((a) => a.field === 'backfill')).toEqual([]);
  });

  it('data-entry: today-7 la ngay cu nhat khong can nhap bu (khong nhan), today-8 chi vao duoc nhan nhap bu neu co khoang', async () => {
    // today = 2026-09-16 -> today-7 = 2026-09-09, today-8 = 2026-09-08
    expect(await saveDailyResourcesAction(1, '2026-09-08', cell())).toEqual({ ok: false, error: 'out_of_window' });
    expect((await saveDailyResourcesAction(1, '2026-09-09', cell())).ok).toBe(true);
    expect(repo.getAuditLog().some((a) => a.field === 'backfill' && a.recordId === '1/2026-09-09')).toBe(false);

    await enable(1, '2026-09-01', '2026-09-16');
    login(PIC);
    expect((await saveDailyResourcesAction(1, '2026-09-08', cell())).ok).toBe(true);
    expect(repo.getAuditLog().some((a) => a.field === 'backfill' && a.recordId === '1/2026-09-08')).toBe(true);
    // today-7 nam trong khoang nhung KHONG can nhap bu: khong duoc gan nhan
    expect((await saveDailyResourcesAction(1, '2026-09-09', cell(6, 6), 'sua so ngay cu')).ok).toBe(true);
    expect(repo.getAuditLog().some((a) => a.field === 'backfill' && a.recordId === '1/2026-09-09')).toBe(false);
  });

  it('khoang lot vao tuong lai (chen thang vao repo, bo qua action): ngay > today+30 van chan du nam trong khoang', async () => {
    repo.createBackfillWindow({ projectId: 1, fromDate: '2026-09-17', toDate: '2026-11-30', note: 'x', expiresAt: null }, ADMIN.email);
    // max = 2026-10-16
    expect(await saveDailyResourcesAction(1, '2026-10-17', cell(1, 0))).toEqual({ ok: false, error: 'out_of_window' });
    expect((await saveDailyResourcesAction(1, '2026-10-16', cell(1, 0))).ok).toBe(true);
    // ngay tuong lai la KH hop le, khong phai nhap bu
    expect(repo.getAuditLog().some((a) => a.field === 'backfill' && a.recordId === '1/2026-10-16')).toBe(false);
  });

  it('admin: ngay cu bat ky ghi duoc, khong nhan nhap bu', async () => {
    login(ADMIN);
    expect((await saveDailyResourcesAction(1, '2024-05-05', cell())).ok).toBe(true);
    expect(repo.getAuditLog().some((a) => a.field === 'backfill')).toBe(false);
    expect(actions()).not.toContain('save_daily_resources_backfill');
  });
});

describe('BIEN KHOANG khi bat (enableBackfillAction)', () => {
  const N = 'ghi chu nhap bu';
  const ok = (from: string, to: string, note = N, id = 1) => {
    login(ADMIN);
    return enableBackfillAction(id, from, to, note);
  };

  it('to = hom nay OK; to = mai -> Invalid input; from = to OK; from > to 1 ngay -> Invalid input', async () => {
    expect(await ok('2026-09-16', '2026-09-16')).toEqual({ ok: true });
    expect(await ok('2026-08-01', '2026-08-01', N, 2)).toEqual({ ok: true });
    expect(await ok('2026-09-01', '2026-09-17', N, 3)).toEqual({ ok: false, error: 'Invalid input' });
    expect(await ok('2026-08-02', '2026-08-01', N, 3)).toEqual({ ok: false, error: 'Invalid input' });
    expect(repo.listBackfillWindows(3)).toEqual([]);
  });

  it('24 thang lich chap nhan, 25 thang -> too_long (tinh theo thang lich cham toi, khong theo so ngay)', async () => {
    expect(await ok('2024-10-01', '2026-09-16')).toEqual({ ok: true }); // 10/2024..09/2026 = 24 thang
    expect(await ok('2024-09-30', '2026-09-16', N, 2)).toEqual({ ok: false, error: 'too_long' }); // 09/2024..09/2026 = 25 thang
    expect(await ok('2024-09-01', '2026-09-16', N, 3)).toEqual({ ok: false, error: 'too_long' });
    // khoang 24 thang nhung cach xa hom nay van ok (chi cap do dai)
    expect(await ok('2022-01-01', '2023-12-31', N, 5)).toEqual({ ok: true });
  });

  it('ghi chu: 4 ky tu loi, 5 OK, 500 OK, 501 loi, chi khoang trang loi, khoang trang dau/cuoi bi cat truoc khi dem', async () => {
    expect(await ok('2025-01-01', '2025-01-02', 'abcd')).toEqual({ ok: false, error: 'Invalid input' });
    expect(await ok('2025-01-01', '2025-01-02', '      ')).toEqual({ ok: false, error: 'Invalid input' });
    expect(await ok('2025-01-01', '2025-01-02', '  abcd  ')).toEqual({ ok: false, error: 'Invalid input' });
    expect(await ok('2025-01-01', '2025-01-02', 'a'.repeat(501))).toEqual({ ok: false, error: 'Invalid input' });
    expect(await ok('2025-01-01', '2025-01-02', 'a'.repeat(10_000))).toEqual({ ok: false, error: 'Invalid input' });
    expect(repo.listBackfillWindows(1)).toEqual([]);
    expect(await ok('2025-01-01', '2025-01-02', 'abcde')).toEqual({ ok: true });
    expect(await ok('2025-02-01', '2025-02-02', 'b'.repeat(500))).toEqual({ ok: true });
    expect(await ok('2025-03-01', '2025-03-02', '  xyzwv  ')).toEqual({ ok: true });
    expect(repo.listBackfillWindows(1).find((w) => w.fromDate === '2025-03-01')!.note).toBe('xyzwv');
  });

  it('du lieu sai kieu goi thang action (client gia mao): Invalid input, khong nem loi', async () => {
    login(ADMIN);
    const bad = enableBackfillAction as unknown as (...a: unknown[]) => Promise<unknown>;
    for (const args of [
      ['1', '2025-01-01', '2025-01-02', N],
      [1, null, '2025-01-02', N],
      [1, '2025-01-01', 20250102, N],
      [1, { a: 1 }, '2025-01-02', N],
      [1, '2025-01-01', '2025-01-02', null],
      [1, '2025-01-01', '2025-01-02', { length: 10 }],
      [Number.POSITIVE_INFINITY, '2025-01-01', '2025-01-02', N],
      [Number.MAX_SAFE_INTEGER + 2, '2025-01-01', '2025-01-02', N],
      [1, "2025-01-01'; DROP TABLE dim_project;--", '2025-01-02', N],
      [1, '2025-01-01T00:00:00.000Z', '2025-01-02', N],
      [1, '0000-01-01', '2025-01-02', N],
      [1, '9999-12-31', '9999-12-31', N],
    ]) {
      const res = (await bad(...args)) as { ok: boolean; error?: string };
      expect(res.ok, JSON.stringify(args)).toBe(false);
      expect(['Invalid input', 'too_long', 'Not found']).toContain(res.error);
    }
    expect(repo.listBackfillWindows(1)).toEqual([]);
  });

  it('khoang trung: giong het, chua trong nhau, cham 1 ngay -> overlap; lien ke -> ok; khac du an -> ok; khoang cua du an khac khong chan', async () => {
    expect(await ok('2025-03-10', '2025-03-20')).toEqual({ ok: true });
    expect(await ok('2025-03-10', '2025-03-20')).toEqual({ ok: false, error: 'overlap' });
    expect(await ok('2025-03-12', '2025-03-14')).toEqual({ ok: false, error: 'overlap' });
    expect(await ok('2025-03-01', '2025-03-31')).toEqual({ ok: false, error: 'overlap' });
    expect(await ok('2025-03-20', '2025-03-25')).toEqual({ ok: false, error: 'overlap' });
    expect(await ok('2025-03-01', '2025-03-10')).toEqual({ ok: false, error: 'overlap' });
    expect(await ok('2025-03-21', '2025-03-25')).toEqual({ ok: true });
    expect(await ok('2025-03-01', '2025-03-09')).toEqual({ ok: true });
    expect(await ok('2025-03-10', '2025-03-20', N, 2)).toEqual({ ok: true });
  });

  it('khoang het han khong chan khoang moi trung; khoang da tat khong chan', async () => {
    repo.createBackfillWindow({ projectId: 1, fromDate: '2025-03-10', toDate: '2025-03-20', note: 'het han', expiresAt: new Date(Date.now() - 1) }, ADMIN.email);
    expect(await ok('2025-03-10', '2025-03-20')).toEqual({ ok: true });
    const id = repo.listBackfillWindows(1)[0]!.id;
    login(ADMIN);
    expect(await disableBackfillAction(id)).toEqual({ ok: true });
    expect(await ok('2025-03-10', '2025-03-20')).toEqual({ ok: true });
  });

  it('bat 2 lan lien tiep cung khoang (nhan dup click): lan 2 overlap, chi 1 dong con hieu luc', async () => {
    const [a, b] = [await ok('2025-03-10', '2025-03-20'), await ok('2025-03-10', '2025-03-20')];
    expect([a, b]).toEqual([{ ok: true }, { ok: false, error: 'overlap' }]);
    expect(repo.readActiveBackfillWindows(1, new Date())).toHaveLength(1);
  });
});

describe('HET HAN, TAT ROI GHI LAI', () => {
  it('khoang het han dung 30 ngay: con dung truoc 30 ngay, het hieu luc tu dung moc 30 ngay', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = new Date('2026-09-16T08:00:00Z');
    vi.setSystemTime(t0);
    await enable(1, '2025-01-01', '2025-06-30');
    const [w] = repo.listBackfillWindows(1);
    expect(new Date(w!.expiresAt!).getTime() - t0.getTime()).toBe(30 * 24 * 3600 * 1000);

    login(PIC);
    vi.setSystemTime(new Date(t0.getTime() + 30 * 24 * 3600 * 1000 - 1000));
    expect((await saveDailyResourcesAction(1, '2025-03-10', cell())).ok).toBe(true);
    vi.setSystemTime(new Date(t0.getTime() + 30 * 24 * 3600 * 1000));
    expect(await saveDailyResourcesAction(1, '2025-03-11', cell())).toEqual({ ok: false, error: 'out_of_window' });
    expect(await saveMonthlyData(1, '2025-03', { ac: 10 })).toEqual({ ok: false, error: 'out_of_window' });
    expect(await commitDailyImportAction(1, [{ workDate: '2025-03-11', ...cell() }])).toEqual({ ok: false, error: 'out_of_window', workDate: '2025-03-11' });
    const res = (await commitImportAction('2025-03', [{ projectId: 1, pctActual: 0.3 }])) as { imported: number; failed: unknown[] };
    expect(res.imported).toBe(0);
    expect(res.failed).toEqual([{ projectId: 1, reason: 'out_of_window' }]);
  });

  it('tat roi ghi lai: ngay cu bi khoa; bat lai khoang moi thi ghi lai duoc; dong cu van con trong lich su', async () => {
    await enable(1, '2025-01-01', '2025-06-30');
    login(PIC);
    expect((await saveDailyResourcesAction(1, '2025-03-10', cell())).ok).toBe(true);
    const id = repo.listBackfillWindows(1)[0]!.id;
    login(ADMIN);
    expect(await disableBackfillAction(id)).toEqual({ ok: true });
    login(PIC);
    expect(await saveDailyResourcesAction(1, '2025-03-11', cell())).toEqual({ ok: false, error: 'out_of_window' });
    expect(await saveMonthlyData(1, '2025-03', { ac: 10 })).toEqual({ ok: false, error: 'out_of_window' });
    await enable(1, '2025-03-01', '2025-03-31');
    login(PIC);
    expect((await saveDailyResourcesAction(1, '2025-03-11', cell())).ok).toBe(true);
    expect(repo.listBackfillWindows(1)).toHaveLength(2);
  });

  it('tat khoang cua du an 1 khong dong cua du an 2 (2 khoang song song)', async () => {
    await enable(1, '2025-01-01', '2025-06-30');
    await enable(2, '2025-01-01', '2025-06-30');
    const id1 = repo.listBackfillWindows(1)[0]!.id;
    login(ADMIN);
    await disableBackfillAction(id1);
    login(PIC);
    expect(await saveMonthlyData(1, '2025-03', { ac: 10 })).toEqual({ ok: false, error: 'out_of_window' });
    expect((await saveMonthlyData(2, '2025-03', { ac: 10 })).ok).toBe(true);
  });
});

describe('BIEN THANG (saveMonthlyData) va KHOA SO (Q10)', () => {
  it('khoang chi cham 1 ngay cua thang mo ca thang do: 31/03 - 02/04 mo 03 va 04, khong mo 02 va 05', async () => {
    await enable(1, '2025-03-31', '2025-04-02');
    login(PIC);
    expect((await saveMonthlyData(1, '2025-03', { ac: 1 })).ok).toBe(true);
    expect((await saveMonthlyData(1, '2025-04', { ac: 1 })).ok).toBe(true);
    expect(await saveMonthlyData(1, '2025-02', { ac: 1 })).toEqual({ ok: false, error: 'out_of_window' });
    expect(await saveMonthlyData(1, '2025-05', { ac: 1 })).toEqual({ ok: false, error: 'out_of_window' });
  });

  it('"thang truoc" vao thang 1: hom nay 2026-01-15 khong ap dung o day; kiem qua lib: thang 1 -> thang 12 nam truoc', async () => {
    const { isMonthAllowed } = await import('@/lib/monthly-entry');
    expect(isMonthAllowed('data-entry', '2025-12', '2026-01-15', [])).toBe(true);
    expect(isMonthAllowed('data-entry', '2025-11', '2026-01-15', [])).toBe(false);
    expect(isMonthAllowed('data-entry', '2026-02', '2026-01-15', [])).toBe(false);
    expect(isMonthAllowed('data-entry', '2025-11', '2026-01-15', [{ from: '2025-11-30', to: '2025-12-01' }])).toBe(true);
    expect(isMonthAllowed('bod', '2025-11', '2026-01-15', [])).toBe(false);
    expect(isMonthAllowed('viewer', '2026-01', '2026-01-15', [])).toBe(true); // luat thuan; viewer bi chan boi requireProject
    expect(isMonthAllowed('admin', '1999-01', '2026-01-15', [])).toBe(true);
  });

  it('thang tuong lai bi chan cho PIC (2026-10 va 2027-09); thang hien tai / thang truoc ghi duoc qua luat thang', async () => {
    login(PIC);
    expect(await saveMonthlyData(1, '2026-10', { ac: 1 })).toEqual({ ok: false, error: 'out_of_window' });
    expect(await saveMonthlyData(1, '2027-09', { ac: 1 })).toEqual({ ok: false, error: 'out_of_window' });
    expect((await saveMonthlyData(1, '2026-09', { ac: 1 })).ok).toBe(true);
  });

  it('thang khoa so: khoang chua thang khoa -> locked (khong out_of_window); admin cung bi locked', async () => {
    await enable(1, '2026-01-01', '2026-06-30');
    expect(repo.isMonthLocked('2026-03')).toBe(true);
    login(PIC);
    expect(await saveMonthlyData(1, '2026-03', { ac: 1 })).toEqual({ ok: false, error: 'locked' });
    expect(await saveDailyResourcesAction(1, '2026-03-10', cell())).toEqual({ ok: false, error: 'locked', month: '2026-03' });
    expect(await commitDailyImportAction(1, [{ workDate: '2026-03-10', ...cell() }])).toEqual({ ok: false, error: 'locked', month: '2026-03', workDate: '2026-03-10' });
    expect(await commitImportAction('2026-03', [{ projectId: 1, pctActual: 0.3 }])).toEqual({ ok: false, error: 'locked' });
    login(ADMIN);
    expect(await saveMonthlyData(1, '2026-03', { ac: 1 })).toEqual({ ok: false, error: 'locked' });
  });

  it('khoang chay qua thang khoa va thang mo (2026-08 khoa, 2026-09 chua khoa): ngay thang 9 ghi duoc, thang 8 locked', async () => {
    await enable(1, '2026-08-20', '2026-09-16');
    expect(repo.isMonthLocked('2026-08')).toBe(true);
    expect(repo.isMonthLocked('2026-09')).toBe(false);
    login(PIC);
    expect(await saveDailyResourcesAction(1, '2026-08-25', cell())).toEqual({ ok: false, error: 'locked', month: '2026-08' });
    expect(await saveDailyResourcesAction(1, '2026-09-08', cell())).toMatchObject({ ok: true });
    // commit nhieu ngay: 1 ngay thuoc thang khoa -> tu choi ca lo, khong ngay nao duoc ghi
    const res = await commitDailyImportAction(1, [
      { workDate: '2026-09-07', ...cell(9, 9) },
      { workDate: '2026-08-25', ...cell(9, 9) },
    ]);
    expect(res).toEqual({ ok: false, error: 'locked', month: '2026-08', workDate: '2026-08-25' });
    expect(repo.getDailyManpowerByShift(1, '2026-09-07', '2026-09-07')).toEqual([]);
  });
});

describe('NHAN "nhap bu" o audit_log va activity_log', () => {
  it('luu ngay: audit backfill + activity save_daily_resources_backfill; luu ngay gan: khong nhan', async () => {
    await enable(1, '2025-01-01', '2025-06-30');
    login(PIC);
    await saveDailyResourcesAction(1, '2025-03-10', cell());
    await saveDailyResourcesAction(1, '2026-09-16', cell(2, 2));
    const a = repo.getActivity();
    expect(a.filter((x) => x.action === 'save_daily_resources_backfill' && x.userEmail === PIC.email && x.detail.includes('2025-03-10'))).toHaveLength(1);
    expect(a.filter((x) => x.action === 'save_daily_resources' && x.detail.includes('2026-09-16'))).toHaveLength(1);
    expect(repo.getAuditLog().filter((x) => x.field === 'backfill')).toHaveLength(1);
  });

  it('luu thang: audit fact_progress_monthly/backfill + activity save_data_backfill; thang hien tai save_data', async () => {
    await enable(1, '2025-01-01', '2025-06-30');
    login(PIC);
    await saveMonthlyData(1, '2025-03', { ac: 5 });
    await saveMonthlyData(1, '2026-09', { ac: 5 });
    expect(repo.getAuditLog().filter((x) => x.field === 'backfill' && x.tableName === 'fact_progress_monthly').map((x) => x.recordId)).toEqual(['1/2025-03']);
    expect(actions()).toEqual(expect.arrayContaining(['save_data_backfill', 'save_data']));
  });

  it('commit Excel ngay: nhan commit_daily_import_backfill khi co ngay nhap bu; commit ngay thuong: commit_daily_import; audit moi ngay cu 1 dong', async () => {
    await enable(1, '2025-01-01', '2025-06-30');
    login(PIC);
    await commitDailyImportAction(1, [
      { workDate: '2025-03-10', ...cell() },
      { workDate: '2025-03-11', ...cell() },
      { workDate: '2026-09-16', ...cell(3, 3) },
    ]);
    expect(actions()).toContain('commit_daily_import_backfill');
    expect(repo.getAuditLog().filter((x) => x.field === 'backfill').map((x) => x.recordId).sort()).toEqual(['1/2025-03-10', '1/2025-03-11']);
    await commitDailyImportAction(1, [{ workDate: '2026-09-15', ...cell(3, 3) }], 'sua so ngay cu');
    expect(actions().filter((a) => a === 'commit_daily_import')).toHaveLength(1);
  });

  it('commit Excel thang: nhan commit_import_backfill khi co dong duoc ghi; khi tat ca dong bi tu choi -> commit_import (khong nhan)', async () => {
    await enable(1, '2025-01-01', '2025-06-30');
    login(PIC);
    await commitImportAction('2025-03', [{ projectId: 1, pctActual: 0.3 }]);
    expect(actions()).toContain('commit_import_backfill');
    expect(repo.getAuditLog().filter((x) => x.field === 'backfill' && x.recordId === '1/2025-03')).toHaveLength(1);
    repo.reset();
    login(PIC);
    await commitImportAction('2025-03', [{ projectId: 1, pctActual: 0.3 }]);
    expect(actions()).toContain('commit_import');
    expect(actions()).not.toContain('commit_import_backfill');
    expect(repo.getAuditLog().filter((x) => x.field === 'backfill')).toEqual([]);
  });

  it('bat/tat: activity backfill_enable/backfill_disable co chi tiet du an; audit_log project_backfill_window enable/disable', async () => {
    await enable(1, '2025-01-01', '2025-06-30');
    const id = repo.listBackfillWindows(1)[0]!.id;
    login(ADMIN);
    await disableBackfillAction(id);
    const a = repo.getActivity();
    expect(a.find((x) => x.action === 'backfill_enable')?.detail).toContain('project 1');
    expect(a.find((x) => x.action === 'backfill_disable')?.detail).toContain(`window ${id}`);
    const au = repo.getAuditLog().filter((x) => x.tableName === 'project_backfill_window');
    // getAuditLog sap theo changedAt (mili giay) nen thu tu enable/disable khong on dinh: so sanh theo tap.
    expect(au.map((x) => x.field).sort()).toEqual(['disable', 'enable']);
    expect(au.every((x) => x.changedBy === ADMIN.email)).toBe(true);
  });

  it('Forbidden va Invalid input KHONG de lai dong activity/audit rac', async () => {
    login(VIEWER);
    await enableBackfillAction(1, '2025-01-01', '2025-01-02', NOTE);
    login(ADMIN);
    await enableBackfillAction(1, '2025-01-02', '2025-01-01', NOTE);
    expect(repo.getActivity().filter((x) => x.action.startsWith('backfill'))).toEqual([]);
    expect(repo.getAuditLog().filter((x) => x.tableName === 'project_backfill_window')).toEqual([]);
  });

  it('moi nhan hoat dong nhap bu co ban dich vi + en (khong lo key tho o Nhat ky hoat dong)', () => {
    const keys = ['backfill_enable', 'backfill_disable', 'save_data_backfill', 'commit_import_backfill', 'save_daily_resources_backfill', 'commit_daily_import_backfill'];
    const vi_ = (viMessages as unknown as { activity: Record<string, string> }).activity;
    const en_ = (enMessages as unknown as { activity: Record<string, string> }).activity;
    for (const k of keys) {
      expect(vi_[k], `vi ${k}`).toBeTruthy();
      expect(en_[k], `en ${k}`).toBeTruthy();
      expect(vi_[k]).not.toBe(k);
      expect(en_[k]).not.toBe(k);
    }
    for (const k of ['save_data_backfill', 'commit_import_backfill', 'save_daily_resources_backfill', 'commit_daily_import_backfill']) {
      expect(vi_[k]).toMatch(/nhập bù/);
      expect(en_[k]).toMatch(/backfill/i);
    }
  });

  it('cac key activity cua nhom F co trong activity.<action> voi moi action ma code ghi (quet ma nguon)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const files = ['src/server/actions-entry.ts', 'src/server/actions.ts', 'src/server/actions-backfill.ts'].map((f) => fs.readFileSync(path.resolve(f), 'utf8'));
    const found = new Set<string>();
    for (const src of files) for (const m of src.matchAll(/'((?:[a-z_]+_)?backfill(?:_[a-z]+)?)'/g)) found.add(m[1]!);
    const vi_ = (viMessages as unknown as { activity: Record<string, string> }).activity;
    for (const k of found) if (k.includes('_') && k !== 'nhap_bu') expect(vi_[k], k).toBeTruthy();
  });
});

describe('EXCEL NGAY co dong ngoai khoang', () => {
  async function file(rows: (string | number)[][]): Promise<File> {
    const ExcelJS = (await import('exceljs')).default;
    const tpl = await buildDailyTemplate({ members: repo.getContractors(1), shifts: repo.getShifts(), equipments: repo.getEquipments() });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(tpl as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('NhanLuc')!;
    for (const r of rows) ws.addRow(r);
    return new File([await wb.xlsx.writeBuffer()], 'ngay.xlsx');
  }
  const form = (projectId: number, f: File) => {
    const fd = new FormData();
    fd.set('projectId', String(projectId));
    fd.set('file', f);
    return fd;
  };
  const C = 'Nhà thầu Lắp dựng A';

  it('co khoang: dong trong khoang ok, dong ngoai khoang out_of_window dung rowNo, dong hom nay van ok', async () => {
    await enable(1, '2025-03-01', '2025-03-31');
    login(PIC);
    const res = await previewDailyImportAction(form(1, await file([
      ['2025-03-10', C, 5, 4, 3, 2],
      ['2025-04-10', C, 5, 4, 3, 2],
      ['2026-09-16', C, 1, 1, 1, 1],
    ])));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const byNo = Object.fromEntries(res.rows.map((r) => [r.rowNo, r]));
    expect(byNo[2]).toMatchObject({ status: 'ok' });
    expect(byNo[3]).toMatchObject({ status: 'invalid', reason: 'out_of_window' });
    expect(byNo[4]).toMatchObject({ status: 'ok' });
    expect(res.okCount).toBe(2);
    expect(res.invalidCount).toBe(1);
  });

  it('khong co khoang: ngay cu -> out_of_window; admin: ngay cu ok', async () => {
    login(PIC);
    const f = await file([['2025-03-10', C, 5, 4, 3, 2]]);
    const pic = await previewDailyImportAction(form(1, f));
    expect(pic.ok && pic.rows[0]).toMatchObject({ status: 'invalid', reason: 'out_of_window' });
    login(ADMIN);
    const adm = await previewDailyImportAction(form(1, await file([['2025-03-10', C, 5, 4, 3, 2]])));
    expect(adm.ok && adm.rows[0]).toMatchObject({ status: 'ok' });
  });

  it('khoang cua du an khac khong lam dong hop le: PIC xem truoc file cho du an 2 (khong co khoang) -> out_of_window', async () => {
    await enable(1, '2025-03-01', '2025-03-31');
    login(PIC);
    const res = await previewDailyImportAction(form(2, await file([['2025-03-10', C, 5, 4, 3, 2]])));
    // nha thau cua du an 2 co the khac: chi can dong khong duoc coi la ok
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.rows.every((r) => r.status === 'invalid')).toBe(true);
  });

  it('data-entry khong duoc gan / viewer / bod: xem truoc Forbidden', async () => {
    await enable(1, '2025-03-01', '2025-03-31');
    const f = await file([['2025-03-10', C, 5, 4, 3, 2]]);
    for (const u of [STRANGER, VIEWER, BOD, null]) {
      login(u);
      expect(await previewDailyImportAction(form(1, f))).toEqual({ ok: false, error: 'Forbidden' });
    }
  });

  it('commit: chi gom dong ok thi ghi; kem ngay ngoai khoang -> bi chan ca lo (out_of_window kem workDate)', async () => {
    await enable(1, '2025-03-01', '2025-03-31');
    login(PIC);
    expect((await commitDailyImportAction(1, [{ workDate: '2025-03-10', ...cell() }])).ok).toBe(true);
    const bad = await commitDailyImportAction(1, [
      { workDate: '2025-03-11', ...cell() },
      { workDate: '2025-04-01', ...cell() },
    ]);
    expect(bad).toEqual({ ok: false, error: 'out_of_window', workDate: '2025-04-01' });
    expect(repo.getDailyManpowerByShift(1, '2025-03-11', '2025-03-11')).toEqual([]);
  });
});

describe('EXCEL THANG (importExcelAction + commitImportAction) - diem lech coder da neu', () => {
  function monthForm(rows: Record<string, string>[]): FormData {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Sheet1');
    const fd = new FormData();
    fd.set('file', new File([XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })], 'thang.xlsx'));
    return fd;
  }

  it('MO TA HANH VI: buoc xem truoc (importExcelAction) khong nhan thang nen KHONG bao out_of_window; dong hop le van la mapped', async () => {
    login(PIC);
    const res = (await importExcelAction(monthForm([
      { 'mã sap': 'SAP-EV-BSN-001', 'tên dự án': 'A (du an 11, PIC duoc gan, KHONG co khoang nhap bu)', '% TT': '30' },
      { 'mã sap': 'SAP-MBS-001', 'tên dự án': 'B (du an 16, PIC khong duoc gan)', '% TT': '30' },
    ]))) as { ok: boolean; mapped: number; preview: { status: string; reason: string | null; projectId: number | null }[] };
    expect(res.ok).toBe(true);
    expect(res.mapped).toBe(1);
    expect(res.preview.map((p) => p.reason)).toEqual([null, 'not_assigned']);
    expect(res.preview[0]).toMatchObject({ status: 'mapped', projectId: 11 });
  });

  it('2 du an, chi du an 1 co khoang: commit thang cu -> imported 1, du an 2 nam o failed out_of_window; audit chi cho du an 1', async () => {
    await enable(1, '2025-03-01', '2025-03-31');
    login(PIC);
    const res = (await commitImportAction('2025-03', [
      { projectId: 1, pctActual: 0.3 },
      { projectId: 2, pctActual: 0.4 },
    ])) as { ok: boolean; imported: number; failed: { projectId: number; reason: string }[] };
    expect(res.imported).toBe(1);
    expect(res.failed).toEqual([{ projectId: 2, reason: 'out_of_window' }]);
    expect(repo.getAuditLog().filter((a) => a.field === 'backfill').map((a) => a.recordId)).toEqual(['1/2025-03']);
  });

  it('dong trung projectId + dong cua du an la (999999) khong lam vo luat', async () => {
    await enable(1, '2025-03-01', '2025-03-31');
    login(PIC);
    const res = (await commitImportAction('2025-03', [
      { projectId: 1, pctActual: 0.3 },
      { projectId: 1, pctActual: 0.5 },
      { projectId: 999999, pctActual: 0.5 },
    ])) as { ok: boolean; imported: number; failed: { projectId: number; reason: string }[] };
    expect(res.ok).toBe(true);
    expect(res.failed.find((f) => f.projectId === 999999)?.reason).toBe('not_assigned');
    expect(res.imported).toBeGreaterThanOrEqual(1);
  });

  it('thang rac / rong / pct ngoai khoang -> loi, khong ghi', async () => {
    await enable(1, '2025-03-01', '2025-03-31');
    login(PIC);
    for (const m of ['', '2025-13', '2025-3', 'abc', '2025-03-01', '9999-12']) {
      const res = (await commitImportAction(m, [{ projectId: 1, pctActual: 0.3 }])) as { ok: boolean };
      expect(res.ok, m).toBe(false);
    }
    const res = (await commitImportAction('2025-03', [{ projectId: 1, pctActual: 7 }])) as { ok: boolean };
    expect(res.ok).toBe(false);
    expect(repo.getAuditLog().filter((a) => a.field === 'backfill')).toEqual([]);
  });

  it('thang rong khoang nhap bu: khong co khoang -> moi dong out_of_window (khong co dong not_found)', async () => {
    login(PIC);
    const res = (await commitImportAction('2025-03', [{ projectId: 1, pctActual: 0.3 }, { projectId: 2, pctActual: 0.3 }])) as {
      imported: number; failed: { projectId: number; reason: string }[];
    };
    expect(res.imported).toBe(0);
    expect(res.failed.map((f) => f.reason)).toEqual(['out_of_window', 'out_of_window']);
  });
});
