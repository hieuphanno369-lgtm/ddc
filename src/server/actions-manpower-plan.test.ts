import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo as mockRepo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';
import type { ManpowerPlanInput } from '@/server/repo/types';
import type { ReadRepo } from '@/server/repo/read-types';

const repo = mockRepo as typeof mockRepo & ReadRepo;

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { saveManpowerPlanAction } from '@/server/actions-entry';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const PM: CurrentUser = { name: 'PM', email: 'pm@daidung.com.vn', role: 'data-entry', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

/** Dung nguyen dang input tu du lieu hien co cua 1 du an (readManpowerPlanMonths + readShiftRatios). */
async function currentInput(projectId: number): Promise<ManpowerPlanInput> {
  const [months, ratios] = await Promise.all([repo.readManpowerPlanMonths(projectId), repo.readShiftRatios(projectId)]);
  const byMonth = new Map<string, { shiftCode: string; planned: number; isManual: boolean }[]>();
  for (const m of months) {
    const list = byMonth.get(m.yearMonth) ?? [];
    list.push({ shiftCode: m.shiftCode, planned: m.planned, isManual: m.isManual });
    byMonth.set(m.yearMonth, list);
  }
  return {
    ratios: ratios.map((r) => ({ shiftCode: r.shiftCode, pct: r.pct })),
    months: [...byMonth.entries()].map(([yearMonth, cells]) => ({ yearMonth, cells })),
  };
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('saveManpowerPlanAction - quyen', () => {
  it('admin -> ok', async () => {
    login(ADMIN);
    const input = await currentInput(1);
    const res = await saveManpowerPlanAction(1, input);
    expect(res.ok).toBe(true);
  });

  it('pm@ la PIC du an 1 -> ok', async () => {
    login(PM);
    const input = await currentInput(1);
    const res = await saveManpowerPlanAction(1, input);
    expect(res.ok).toBe(true);
  });

  it('pm@ khong duoc gan du an 16 -> Forbidden', async () => {
    login(PM);
    const res = await saveManpowerPlanAction(16, { ratios: [], months: [] });
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('viewer -> Forbidden', async () => {
    login(VIEWER);
    expect(await saveManpowerPlanAction(1, { ratios: [], months: [] })).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('bod -> Forbidden', async () => {
    login(BOD);
    expect(await saveManpowerPlanAction(1, { ratios: [], months: [] })).toEqual({ ok: false, error: 'Forbidden' });
  });
});

describe('saveManpowerPlanAction - luat + hanh vi', () => {
  beforeEach(() => login(ADMIN));

  it('gui lai dung du lieu dang co -> ok, khong doi gi, khong them audit', async () => {
    const input = await currentInput(1);
    const auditBefore = repo.getAuditLog().length;
    const res = await saveManpowerPlanAction(1, input);
    expect(res).toEqual({ ok: true, changedMonths: 0, ratioChanged: false });
    expect(repo.getAuditLog().length).toBe(auditBefore);
  });

  it('doi thang 2026-09 -> changedMonths 1, doc lai dung, audit dung old/new', async () => {
    const input = await currentInput(1);
    const idx = input.months.findIndex((m) => m.yearMonth === '2026-09');
    input.months[idx] = { yearMonth: '2026-09', cells: [
      { shiftCode: 'morning', planned: 600, isManual: true },
      { shiftCode: 'evening', planned: 300, isManual: false },
    ] };
    const res = await saveManpowerPlanAction(1, input);
    expect(res).toEqual({ ok: true, changedMonths: 1, ratioChanged: false });
    const rows = await repo.readManpowerPlanMonths(1);
    expect(rows).toContainEqual({ yearMonth: '2026-09', shiftCode: 'morning', planned: 600, isManual: true });
    const entry = repo.getAuditLog().find((a) => a.tableName === 'project_manpower_plan_month' && a.recordId === '1/2026-09');
    expect(entry).toMatchObject({ oldValue: 'morning:540,evening:360', newValue: 'morning:600(m),evening:300' });
  });

  it('bo thang 2026-12 -> audit new rong, khong con dong thang do', async () => {
    const input = await currentInput(1);
    input.months = input.months.filter((m) => m.yearMonth !== '2026-12');
    const res = await saveManpowerPlanAction(1, input);
    expect(res.ok).toBe(true);
    const entry = repo.getAuditLog().find((a) => a.tableName === 'project_manpower_plan_month' && a.recordId === '1/2026-12');
    expect(entry?.newValue).toBe('');
    const rows = await repo.readManpowerPlanMonths(1);
    expect(rows.some((r) => r.yearMonth === '2026-12')).toBe(false);
  });

  it('doi ty le 0.7/0.3 -> ratioChanged true, audit dung old/new', async () => {
    const input = await currentInput(1);
    input.ratios = [{ shiftCode: 'morning', pct: 0.7 }, { shiftCode: 'evening', pct: 0.3 }];
    const res = await saveManpowerPlanAction(1, input);
    expect(res).toMatchObject({ ok: true, ratioChanged: true });
    const entry = repo.getAuditLog().find((a) => a.tableName === 'project_shift_ratio');
    expect(entry).toMatchObject({ recordId: '1', oldValue: 'morning:0.6,evening:0.4', newValue: 'morning:0.7,evening:0.3' });
  });

  it('du an 17 (chua co ty le) luu 0.6/0.4 + 1 thang -> audit ty le KHONG ghi, thang ghi voi old rong', async () => {
    const res = await saveManpowerPlanAction(17, {
      ratios: [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }],
      months: [{ yearMonth: '2026-09', cells: [
        { shiftCode: 'morning', planned: 100, isManual: false }, { shiftCode: 'evening', planned: 50, isManual: false },
      ] }],
    });
    expect(res).toEqual({ ok: true, changedMonths: 1, ratioChanged: false });
    expect(repo.getAuditLog().some((a) => a.tableName === 'project_shift_ratio' && a.recordId === '17')).toBe(false);
    const entry = repo.getAuditLog().find((a) => a.tableName === 'project_manpower_plan_month' && a.recordId === '17/2026-09');
    expect(entry?.oldValue).toBe('');
  });

  it('tong ty le 1.1 -> invalid_plan, errors.ratio sum, du lieu khong doi', async () => {
    const input = await currentInput(1);
    const before = await repo.readManpowerPlanMonths(1);
    input.ratios = [{ shiftCode: 'morning', pct: 0.7 }, { shiftCode: 'evening', pct: 0.4 }];
    const res = await saveManpowerPlanAction(1, input);
    expect(res.ok).toBe(false);
    if (!res.ok) { expect(res.error).toBe('invalid_plan'); expect(res.errors?.ratio).toBe('sum'); }
    expect(await repo.readManpowerPlanMonths(1)).toEqual(before);
  });

  it('ca la (afternoon) trong cells -> invalid_plan, errors.months[0] co cells', async () => {
    const input = await currentInput(1);
    input.months[0] = { yearMonth: input.months[0].yearMonth, cells: [
      { shiftCode: 'afternoon', planned: 100, isManual: false }, { shiftCode: 'evening', planned: 50, isManual: false },
    ] };
    const res = await saveManpowerPlanAction(1, input);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors?.months[0]).toContain('cells');
  });

  it('planned -1 -> Invalid input (zod)', async () => {
    const input = await currentInput(1);
    input.months[0] = { yearMonth: input.months[0].yearMonth, cells: [
      { shiftCode: 'morning', planned: -1, isManual: false }, { shiftCode: 'evening', planned: 50, isManual: false },
    ] };
    const res = await saveManpowerPlanAction(1, input);
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('readProjectAuditTrail(1,50) tra duoc dong project_manpower_plan_month va project_shift_ratio', async () => {
    const input = await currentInput(1);
    input.ratios = [{ shiftCode: 'morning', pct: 0.7 }, { shiftCode: 'evening', pct: 0.3 }];
    const idx = input.months.findIndex((m) => m.yearMonth === '2026-09');
    input.months[idx] = { yearMonth: '2026-09', cells: [
      { shiftCode: 'morning', planned: 600, isManual: true }, { shiftCode: 'evening', planned: 300, isManual: false },
    ] };
    await saveManpowerPlanAction(1, input);
    const trail = repo.readProjectAuditTrail(1, 50);
    expect(trail.some((a) => a.tableName === 'project_manpower_plan_month')).toBe(true);
    expect(trail.some((a) => a.tableName === 'project_shift_ratio')).toBe(true);
  });
});
