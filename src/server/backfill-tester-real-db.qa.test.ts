/**
 * P4 nhom F - tester: luong nhap bu tren Postgres THAT qua server action (repo Prisma), khong mock repo.
 * Bo qua khi `npm test` binh thuong (khong co `DATABASE_URL`); chay tay tren DB _c bang:
 *   $env:DATABASE_URL='postgresql://postgres:<mat-khau>@localhost:5433/ddc_control_tower_c?schema=public'
 *   npx vitest run src/server/backfill-tester-real-db.qa.test.ts
 * Du an test co ma `test-p4-tester-a` / `test-p4-tester-b`, email test `test-p4-*@daidung.com.vn`; moi dong sinh ra
 * (khoang, audit_log, activity_log, so ngay/thang) tu don o afterAll. Thang khoa so cua seed duoc mo tam thoi roi tra lai NGUYEN.
 * Ngay hom nay ghim DDC_FAKE_TODAY = 2026-09-16 (vitest.config.ts).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '@/lib/session';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

const hasDb = Boolean(process.env.DATABASE_URL);
const CODE_A = 'test-p4-tester-a';
const CODE_B = 'test-p4-tester-b';
const ADMIN: CurrentUser = { name: 'Admin test', email: 'test-p4-admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const PIC: CurrentUser = { name: 'PIC test', email: 'test-p4-pic@daidung.com.vn', role: 'data-entry', canViewFinance: false };
const NOTE = 'test-p4 nhap bu';
const DAY = new Date('2025-03-10T00:00:00Z');

describe.skipIf(!hasDb)('nhap bu lich su tren Postgres that (DB _c) qua server action', () => {
  let prisma: typeof import('@/server/db').prisma;
  let getCurrentUser: Mock;
  let A = 0;
  let B = 0;
  let contractorId = 0;
  let enableBackfillAction: typeof import('@/server/actions-backfill').enableBackfillAction;
  let disableBackfillAction: typeof import('@/server/actions-backfill').disableBackfillAction;
  let saveDailyResourcesAction: typeof import('@/server/actions-entry').saveDailyResourcesAction;
  let commitDailyImportAction: typeof import('@/server/actions-entry').commitDailyImportAction;
  let saveMonthlyData: typeof import('@/server/actions').saveMonthlyData;
  let commitImportAction: typeof import('@/server/actions').commitImportAction;
  let repo: typeof import('@/server/repo').repo;
  const login = (u: CurrentUser | null) => getCurrentUser.mockResolvedValue(u);
  const cell = (planned = 5, actual = 5) => ({
    manpower: [{ contractorId, shiftCode: 'morning', plannedHeadcount: planned, actualHeadcount: actual }],
    equipment: [],
  });
  const emails = [ADMIN.email, PIC.email];

  async function wipeWindows() {
    const ids = (await prisma.projectBackfillWindow.findMany({ where: { projectId: { in: [A, B] } }, select: { id: true, projectId: true } })).map((r) => `${r.projectId}/${r.id}`);
    if (ids.length) await prisma.auditLog.deleteMany({ where: { tableName: 'project_backfill_window', recordId: { in: ids } } });
    await prisma.projectBackfillWindow.deleteMany({ where: { projectId: { in: [A, B] } } });
  }
  async function wipeData() {
    await prisma.factDailyManpower.deleteMany({ where: { projectId: { in: [A, B] } } });
    await prisma.factProgressMonthly.deleteMany({ where: { projectId: { in: [A, B] } } });
    await prisma.auditLog.deleteMany({ where: { changedBy: { in: emails } } });
    await prisma.activityLog.deleteMany({ where: { userEmail: { in: emails } } });
  }

  beforeAll(async () => {
    if (!hasDb) return;
    ({ prisma } = await import('@/server/db'));
    ({ repo } = await import('@/server/repo'));
    getCurrentUser = (await import('@/lib/session')).getCurrentUser as Mock;
    ({ enableBackfillAction, disableBackfillAction } = await import('@/server/actions-backfill'));
    ({ saveDailyResourcesAction, commitDailyImportAction } = await import('@/server/actions-entry'));
    ({ saveMonthlyData, commitImportAction } = await import('@/server/actions'));

    await prisma.project.deleteMany({ where: { masterCode: { in: [CODE_A, CODE_B] } } });
    const customer = await prisma.customer.findFirstOrThrow();
    const team = await prisma.teamKd.findFirstOrThrow();
    const mk = async (code: string) =>
      (await prisma.project.create({
        data: {
          masterCode: code, currentAliasCode: `${code}-alias`, projectName: code, customerId: customer.id, teamKdId: team.id,
          marketCode: 'TN', projectType: 'EPC', priority: 'P2', contractValue: 1, tonnage: 1, currencyCode: 'VND',
          createdBy: 'test', updatedBy: 'test',
        },
      })).id;
    A = await mk(CODE_A);
    B = await mk(CODE_B);
    await prisma.projectAssignment.create({ data: { projectId: A, userEmail: PIC.email, roleInProject: 'PIC', assignedBy: 'test' } });
    const c = await repo.createContractor('test-p4-tester nha thau', 'x', 'test');
    contractorId = c.id;
    await repo.addProjectContractor(A, contractorId, 'test');
  });

  afterAll(async () => {
    if (!hasDb || !prisma) return;
    await wipeWindows();
    await wipeData();
    await prisma.project.deleteMany({ where: { masterCode: { in: [CODE_A, CODE_B] } } });
    if (contractorId) {
      await prisma.projectContractor.deleteMany({ where: { contractorId } });
      await prisma.contractor.deleteMany({ where: { id: contractorId } });
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!hasDb) return;
    await wipeWindows();
    await wipeData();
    vi.clearAllMocks();
  });

  async function enable(projectId: number, from = '2025-01-01', to = '2025-06-30') {
    login(ADMIN);
    expect(await enableBackfillAction(projectId, from, to, NOTE)).toEqual({ ok: true });
  }

  it('admin bat: dong khoang co expiresAt ~ +30 ngay, audit_log enable, activity_log backfill_enable', async () => {
    await enable(A);
    const [w] = await prisma.projectBackfillWindow.findMany({ where: { projectId: A } });
    expect(w).toMatchObject({ enabledBy: ADMIN.email, note: NOTE, disabledAt: null });
    expect(w!.fromDate.toISOString().slice(0, 10)).toBe('2025-01-01');
    expect(w!.toDate.toISOString().slice(0, 10)).toBe('2025-06-30');
    const days = (w!.expiresAt!.getTime() - w!.enabledAt.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(29.99);
    expect(days).toBeLessThan(30.01);
    expect(await prisma.auditLog.count({ where: { tableName: 'project_backfill_window', recordId: `${A}/${w!.id}`, field: 'enable' } })).toBe(1);
    expect(await prisma.activityLog.count({ where: { action: 'backfill_enable', userEmail: ADMIN.email } })).toBe(1);
  });

  it('PIC luu ngay cu trong khoang: so vao DB, audit_log backfill (fact_daily_resources) + activity_log save_daily_resources_backfill', async () => {
    login(PIC);
    expect(await saveDailyResourcesAction(A, '2025-03-10', cell())).toEqual({ ok: false, error: 'out_of_window' });
    await enable(A);
    login(PIC);
    const res = await saveDailyResourcesAction(A, '2025-03-10', cell(7, 6));
    expect(res.ok).toBe(true);
    const row = await prisma.factDailyManpower.findFirst({ where: { projectId: A, workDate: DAY } });
    expect(row).toMatchObject({ plannedHeadcount: 7, actualHeadcount: 6 });
    const audit = await prisma.auditLog.findFirst({ where: { field: 'backfill', recordId: `${A}/2025-03-10` } });
    expect(audit).toMatchObject({ tableName: 'fact_daily_resources', newValue: 'nhap bu', changedBy: PIC.email });
    const act = await prisma.activityLog.findFirst({ where: { action: 'save_daily_resources_backfill', userEmail: PIC.email } });
    expect(act?.detail).toContain('2025-03-10');
    // ngay ngoai khoang van chan
    expect(await saveDailyResourcesAction(A, '2025-07-01', cell())).toEqual({ ok: false, error: 'out_of_window' });
  });

  it('IDOR tren DB that: khoang cua A khong mo B; khoang cua B khong mo cho PIC (khong duoc gan B) tren ca 4 duong', async () => {
    await enable(A);
    await enable(B);
    login(PIC);
    expect(await saveDailyResourcesAction(B, '2025-03-10', cell())).toEqual({ ok: false, error: 'Forbidden' });
    expect(await saveMonthlyData(B, '2025-03', { ac: 10 })).toEqual({ ok: false, error: 'Forbidden' });
    expect(await commitDailyImportAction(B, [{ workDate: '2025-03-10', ...cell() }])).toEqual({ ok: false, error: 'Forbidden' });
    const res = (await commitImportAction('2025-03', [{ projectId: B, pctActual: 0.3 }])) as { imported: number; failed: { projectId: number; reason: string }[] };
    expect(res.imported).toBe(0);
    expect(res.failed).toEqual([{ projectId: B, reason: 'not_assigned' }]);
    expect(await prisma.factDailyManpower.count({ where: { projectId: B } })).toBe(0);
    expect(await prisma.factProgressMonthly.count({ where: { projectId: B } })).toBe(0);
  });

  it('luat thang tren DB that: thang cu cua A ghi duoc khi co khoang (nhan nhap bu), du an co khoang duoc ghi va du an khong co khoang bi failed', async () => {
    login(PIC);
    expect(await saveMonthlyData(A, '2025-03', { ac: 10 })).toEqual({ ok: false, error: 'out_of_window' });
    await enable(A);
    login(PIC);
    expect((await saveMonthlyData(A, '2025-03', { ac: 10 })).ok).toBe(true);
    expect(await prisma.factProgressMonthly.count({ where: { projectId: A, yearMonth: '2025-03' } })).toBeGreaterThan(0);
    const audit = await prisma.auditLog.findFirst({ where: { field: 'backfill', recordId: `${A}/2025-03` } });
    expect(audit).toMatchObject({ tableName: 'fact_progress_monthly', changedBy: PIC.email });
    expect(await prisma.activityLog.count({ where: { action: 'save_data_backfill', userEmail: PIC.email } })).toBe(1);
    // commit Excel thang: chi A duoc gan; thang khac ngoai khoang -> failed out_of_window
    const bad = (await commitImportAction('2024-12', [{ projectId: A, pctActual: 0.3 }])) as { imported: number; failed: { projectId: number; reason: string }[] };
    expect(bad).toMatchObject({ imported: 0, failed: [{ projectId: A, reason: 'out_of_window' }] });
    const ok = (await commitImportAction('2025-04', [{ projectId: A, pctActual: 0.3 }])) as { imported: number };
    expect(ok.imported).toBe(1);
    expect(await prisma.activityLog.count({ where: { action: 'commit_import_backfill', userEmail: PIC.email } })).toBe(1);
  });

  it('HET HAN that: doi expiresAt ve qua khu trong DB -> ca 4 duong out_of_window; danh sach admin van thay dong (trang thai het han)', async () => {
    await enable(A);
    await prisma.projectBackfillWindow.updateMany({ where: { projectId: A }, data: { expiresAt: new Date(Date.now() - 1000) } });
    login(PIC);
    expect(await saveDailyResourcesAction(A, '2025-03-10', cell())).toEqual({ ok: false, error: 'out_of_window' });
    expect(await saveMonthlyData(A, '2025-03', { ac: 10 })).toEqual({ ok: false, error: 'out_of_window' });
    expect(await commitDailyImportAction(A, [{ workDate: '2025-03-10', ...cell() }])).toEqual({ ok: false, error: 'out_of_window', workDate: '2025-03-10' });
    const res = (await commitImportAction('2025-03', [{ projectId: A, pctActual: 0.3 }])) as { failed: { reason: string }[] };
    expect(res.failed).toEqual([{ projectId: A, reason: 'out_of_window' }]);
    const list = await repo.listBackfillWindows(A);
    expect(list).toHaveLength(1);
    const { backfillState } = await import('@/lib/backfill');
    expect(backfillState(list[0]!, new Date())).toBe('expired');
    expect(await repo.readActiveBackfillWindows(A, new Date())).toEqual([]);
    // khoang het han khong chan khoang moi trung ngay
    login(ADMIN);
    expect(await enableBackfillAction(A, '2025-03-01', '2025-03-31', NOTE)).toEqual({ ok: true });
  });

  it('expiresAt DUNG BANG bay gio (canh): coi la het han (khop mock: > now moi con hieu luc)', async () => {
    await enable(A);
    const now = new Date();
    await prisma.projectBackfillWindow.updateMany({ where: { projectId: A }, data: { expiresAt: now } });
    expect(await repo.readActiveBackfillWindows(A, now)).toEqual([]);
    await prisma.projectBackfillWindow.updateMany({ where: { projectId: A }, data: { expiresAt: new Date(now.getTime() + 1000) } });
    expect(await repo.readActiveBackfillWindows(A, now)).toHaveLength(1);
  });

  it('tat roi ghi lai: sau disable ngay cu bi khoa lai, dong van con (disabledAt), audit disable; bat lai khoang moi ghi duoc', async () => {
    await enable(A);
    login(PIC);
    expect((await saveDailyResourcesAction(A, '2025-03-10', cell())).ok).toBe(true);
    const w = (await prisma.projectBackfillWindow.findFirstOrThrow({ where: { projectId: A } }));
    login(ADMIN);
    expect(await disableBackfillAction(w.id)).toEqual({ ok: true });
    expect(await disableBackfillAction(w.id)).toEqual({ ok: false, error: 'already' });
    const after = await prisma.projectBackfillWindow.findUniqueOrThrow({ where: { id: w.id } });
    expect(after.disabledAt).not.toBeNull();
    expect(after.disabledBy).toBe(ADMIN.email);
    expect(await prisma.auditLog.count({ where: { tableName: 'project_backfill_window', recordId: `${A}/${w.id}`, field: 'disable' } })).toBe(1);
    login(PIC);
    expect(await saveDailyResourcesAction(A, '2025-03-11', cell())).toEqual({ ok: false, error: 'out_of_window' });
    await enable(A, '2025-03-01', '2025-03-31');
    login(PIC);
    expect((await saveDailyResourcesAction(A, '2025-03-11', cell())).ok).toBe(true);
  });

  it('KHOA SO (Q10): khoang chua thang 2026-03 khoa -> locked; admin mo khoa thang thi PIC luu duoc; tra khoa nguyen ven', async () => {
    const month = '2026-03';
    const locked = await prisma.factProgressMonthly.findMany({
      where: { yearMonth: month, snapshotLockedAt: { not: null } },
      select: { projectId: true, version: true, snapshotLockedAt: true },
    });
    expect(locked.length).toBeGreaterThan(0); // seed khoa 2025-10..2026-08
    try {
      await enable(A, '2026-03-01', '2026-03-31');
      login(PIC);
      expect(await saveDailyResourcesAction(A, '2026-03-10', cell())).toEqual({ ok: false, error: 'locked', month });
      expect(await saveMonthlyData(A, month, { ac: 1 })).toEqual({ ok: false, error: 'locked' });
      expect(await commitDailyImportAction(A, [{ workDate: '2026-03-10', ...cell() }])).toEqual({ ok: false, error: 'locked', month, workDate: '2026-03-10' });
      expect(await commitImportAction(month, [{ projectId: A, pctActual: 0.3 }])).toEqual({ ok: false, error: 'locked' });
      await prisma.factProgressMonthly.updateMany({ where: { yearMonth: month }, data: { snapshotLockedAt: null } });
      expect(await repo.isMonthLocked(month)).toBe(false);
      login(PIC);
      expect((await saveDailyResourcesAction(A, '2026-03-10', cell())).ok).toBe(true);
    } finally {
      for (const r of locked) {
        await prisma.factProgressMonthly.updateMany({
          where: { projectId: r.projectId, yearMonth: month, version: r.version },
          data: { snapshotLockedAt: r.snapshotLockedAt },
        });
      }
    }
    expect(await repo.isMonthLocked(month)).toBe(true);
  });

  it('RACE thuc: 6 admin bat cung khoang cung du an dong thoi, lap 15 vong -> moi vong dung 1 thanh cong, 5 overlap, 1 dong hieu luc', async () => {
    login(ADMIN);
    for (let round = 0; round < 15; round++) {
      await wipeWindows();
      const results = await Promise.all(Array.from({ length: 6 }, () => enableBackfillAction(A, '2025-03-01', '2025-03-31', NOTE)));
      expect(results.filter((r) => r.ok), `vong ${round}`).toHaveLength(1);
      expect(results.filter((r) => !r.ok && r.error === 'overlap'), `vong ${round}`).toHaveLength(5);
      expect(await prisma.projectBackfillWindow.count({ where: { projectId: A, disabledAt: null } }), `vong ${round}`).toBe(1);
    }
  });

  it('RACE khoang gac nhau (khong giong het): 4 khoang chong len nhau dong thoi -> khong bao gio 2 khoang hieu luc chong nhau', async () => {
    login(ADMIN);
    for (let round = 0; round < 10; round++) {
      await wipeWindows();
      await Promise.all([
        enableBackfillAction(A, '2025-03-01', '2025-03-20', NOTE),
        enableBackfillAction(A, '2025-03-15', '2025-04-05', NOTE),
        enableBackfillAction(A, '2025-03-18', '2025-03-19', NOTE),
        enableBackfillAction(A, '2025-02-20', '2025-03-01', NOTE),
      ]);
      const active = await prisma.projectBackfillWindow.findMany({ where: { projectId: A, disabledAt: null }, orderBy: { fromDate: 'asc' } });
      for (let i = 1; i < active.length; i++) {
        expect(active[i]!.fromDate.getTime(), `vong ${round}`).toBeGreaterThan(active[i - 1]!.toDate.getTime());
      }
    }
  });

  it('RACE tat: 5 lan tat cung 1 khoang dong thoi -> 1 ok, 4 already, audit disable dung 1 dong', async () => {
    await enable(A);
    const w = await prisma.projectBackfillWindow.findFirstOrThrow({ where: { projectId: A } });
    login(ADMIN);
    const results = await Promise.all(Array.from({ length: 5 }, () => disableBackfillAction(w.id)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error === 'already')).toHaveLength(4);
    expect(await prisma.auditLog.count({ where: { tableName: 'project_backfill_window', recordId: `${A}/${w.id}`, field: 'disable' } })).toBe(1);
  });

  it('2 khoang dong thoi cho 2 du an KHAC nhau khong chan nhau', async () => {
    login(ADMIN);
    const [a, b] = await Promise.all([
      enableBackfillAction(A, '2025-03-01', '2025-03-31', NOTE),
      enableBackfillAction(B, '2025-03-01', '2025-03-31', NOTE),
    ]);
    expect([a, b]).toEqual([{ ok: true }, { ok: true }]);
  });
});
