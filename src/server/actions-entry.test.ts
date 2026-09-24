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
import {
  addProjectContractorAction, commitDailyImportAction, createContractorAction, previewDailyImportAction,
  removeProjectContractorAction, saveDailyResourcesAction,
} from '@/server/actions-entry';
import { buildDailyTemplate } from '@/server/daily-import';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('createContractorAction', () => {
  it('PIC du an 1 tao nha thau moi -> ok, getContractors(1) co them', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const before = repo.getContractors(1).length;

    const res = await createContractorAction(1, 'Nhà thầu Điện F', 'Điện nước');

    expect(res.ok).toBe(true);
    expect(repo.getContractors(1)).toHaveLength(before + 1);
  });

  it('data-entry khong duoc gan (du an 16) -> Forbidden', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const res = await createContractorAction(16, 'X', '');
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('viewer -> Forbidden', async () => {
    login(VIEWER);
    const res = await createContractorAction(1, 'X', '');
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('bod -> Forbidden (khong duoc ghi)', async () => {
    login(BOD);
    const res = await createContractorAction(1, 'X', '');
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('trung ten (khong phan biet hoa thuong) -> tra ve id cu, khong tao dong moi', async () => {
    login(ADMIN);
    const before = repo.getContractors().length;

    const res = await createContractorAction(1, '  nhà thầu lắp dựng a ', '');

    expect(res).toEqual({ ok: true, id: 1 });
    expect(repo.getContractors()).toHaveLength(before);
  });

  it('ten rong -> Invalid input', async () => {
    login(ADMIN);
    const res = await createContractorAction(1, '   ', '');
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('du an khong ton tai -> Not found (admin)', async () => {
    login(ADMIN);
    const res = await createContractorAction(999999, 'Nhà thầu mới', '');
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });
});

describe('removeProjectContractorAction', () => {
  it('go nha thau da co so lieu -> has_data', async () => {
    login(ADMIN);
    const res = await removeProjectContractorAction(1, 1);
    expect(res).toEqual({ ok: false, error: 'has_data' });
  });

  it('tao nha thau moi roi go ngay -> ok', async () => {
    login(ADMIN);
    const created = await createContractorAction(1, 'Nhà thầu tạm G', '');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await removeProjectContractorAction(1, created.id);
    expect(res).toEqual({ ok: true });
    expect(repo.getContractors(1).some((c) => c.id === created.id)).toBe(false);
  });

  it('go nha thau khong thuoc du an -> not_member', async () => {
    login(ADMIN);
    // nha thau 6 khong tham gia du an 4 (chi du an 1 co du 6 nha thau seed)
    const res = await removeProjectContractorAction(4, 6);
    expect(res).toEqual({ ok: false, error: 'not_member' });
  });
});

describe('addProjectContractorAction', () => {
  it('them lai nha thau da la thanh vien -> exists van tra ok', async () => {
    login(ADMIN);
    const res = await addProjectContractorAction(1, 1);
    expect(res).toEqual({ ok: true });
  });
});

describe('saveDailyResourcesAction (Task 4)', () => {
  const cell = (planned: number, actual: number) => ({
    manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: planned, actualHeadcount: actual }],
    equipment: [],
  });

  it('PIC luu hom nay ok (created/updated dem dung)', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const res = await saveDailyResourcesAction(1, '2026-09-16', cell(1000, 1000));
    expect(res).toEqual({ ok: true, created: 0, updated: 1, unchanged: 0 });
  });

  it('data-entry ngay 2026-09-08 -> out_of_window; admin cung ngay -> ok', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const res1 = await saveDailyResourcesAction(1, '2026-09-08', cell(1, 1));
    expect(res1).toEqual({ ok: false, error: 'out_of_window' });

    login(ADMIN);
    const res2 = await saveDailyResourcesAction(1, '2026-09-08', cell(1, 1));
    expect(res2.ok).toBe(true);
  });

  it('ngay 2026-10-17 -> out_of_window', async () => {
    login(ADMIN);
    const res = await saveDailyResourcesAction(1, '2026-10-17', cell(1, 0));
    expect(res).toEqual({ ok: false, error: 'out_of_window' });
  });

  it('ngay mai TT > 0 -> actual_future', async () => {
    login(ADMIN);
    const res = await saveDailyResourcesAction(1, '2026-09-17', cell(0, 1));
    expect(res).toEqual({ ok: false, error: 'actual_future' });
  });

  it('hom qua doi so cu khong ly do -> reason_required; co ly do -> ok va audit note dung', async () => {
    login(ADMIN);
    const res1 = await saveDailyResourcesAction(1, '2026-09-15', cell(1000, 1000));
    expect(res1).toEqual({ ok: false, error: 'reason_required' });

    const res2 = await saveDailyResourcesAction(1, '2026-09-15', cell(1000, 1000), 'nhập nhầm');
    expect(res2.ok).toBe(true);
    const last = repo.getAuditLog().find((a) => a.tableName === 'fact_daily_manpower')!;
    expect(last.note).toBe('nhập nhầm');
  });

  it('nha thau khong thuoc du an -> invalid_contractor', async () => {
    login(ADMIN);
    // nha thau 1 khong tham gia du an 2 (chi du an 1 co du 6 nha thau seed)
    const res = await saveDailyResourcesAction(2, '2026-09-16', cell(1, 1));
    expect(res).toEqual({ ok: false, error: 'invalid_contractor' });
  });

  it("ca 'afternoon' (da doi thanh evening) -> invalid_shift", async () => {
    login(ADMIN);
    const res = await saveDailyResourcesAction(1, '2026-09-16', {
      manpower: [{ contractorId: 1, shiftCode: 'afternoon', plannedHeadcount: 1, actualHeadcount: 1 }],
      equipment: [],
    });
    expect(res).toEqual({ ok: false, error: 'invalid_shift' });
  });

  it('thang khoa -> locked + month', async () => {
    login(ADMIN);
    repo.lockMonth('2026-09', 'admin@daidung.com.vn');
    const res = await saveDailyResourcesAction(1, '2026-09-16', cell(1, 1));
    expect(res).toEqual({ ok: false, error: 'locked', month: '2026-09' });
  });

  it('viewer -> Forbidden', async () => {
    login(VIEWER);
    const res = await saveDailyResourcesAction(1, '2026-09-16', cell(1, 1));
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('so 1.5 -> Invalid input', async () => {
    login(ADMIN);
    const res = await saveDailyResourcesAction(1, '2026-09-16', {
      manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 1.5, actualHeadcount: 1 }],
      equipment: [],
    });
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });
});

describe('previewDailyImportAction / commitDailyImportAction (Task 5)', () => {
  async function buildFile(dataRows: (string | number)[][], filename = 'import.xlsx'): Promise<File> {
    const ExcelJS = (await import('exceljs')).default;
    const members = repo.getContractors(1);
    const shifts = repo.getShifts();
    const equipments = repo.getEquipments();
    const tpl = await buildDailyTemplate({ members, shifts, equipments });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(tpl as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('NhanLuc')!;
    for (const row of dataRows) ws.addRow(row);
    const buf = await wb.xlsx.writeBuffer();
    return new File([buf], filename);
  }

  function form(projectId: number, file: File): FormData {
    const fd = new FormData();
    fd.set('projectId', String(projectId));
    fd.set('file', file);
    return fd;
  }

  it('1 ok, 1 nha thau la, 1 ngay hong -> okCount 1, invalidCount 2, rowNo 2,3,4', async () => {
    login(ADMIN);
    const file = await buildFile([
      ['2026-09-16', 'Nhà thầu Lắp dựng A', 5, 4, 3, 2],
      ['2026-09-16', 'Nhà thầu không tồn tại', 1, 1, 1, 1],
      ['khong-phai-ngay', 'Nhà thầu Lắp dựng A', 1, 1, 1, 1],
    ]);

    const res = await previewDailyImportAction(form(1, file));

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.okCount).toBe(1);
    expect(res.invalidCount).toBe(2);
    expect(res.rows.map((r) => r.rowNo)).toEqual([2, 3, 4]);
  });

  it('H-1c: 5002 dong du lieu -> too_many_rows (chan truoc khi parse tung dong)', async () => {
    login(ADMIN);
    const rows: (string | number)[][] = [];
    for (let i = 0; i < 5002; i++) rows.push(['2026-09-16', 'Nhà thầu Lắp dựng A', 1, 1, 1, 1]);
    const file = await buildFile(rows);

    const res = await previewDailyImportAction(form(1, file));

    expect(res).toEqual({ ok: false, error: 'too_many_rows' });
  });

  it("file .xls -> Invalid input", async () => {
    login(ADMIN);
    const file = await buildFile([], 'import.xls');
    const res = await previewDailyImportAction(form(1, file));
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('header dung (khong sua gi) -> preview khong loi bad_header', async () => {
    login(ADMIN);
    const file = await buildFile([]);
    const res = await previewDailyImportAction(form(1, file));
    expect(res.ok).toBe(true);
  });

  it('commit 2 ngay, ngay thu 2 ngoai window -> loi out_of_window + workDate, ngay thu 1 khong duoc ghi', async () => {
    login(ADMIN);
    const before = repo.getDailyManpowerByShift(1, '2026-09-16', '2026-09-16');

    const res = await commitDailyImportAction(1, [
      { workDate: '2026-09-16', manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 1000, actualHeadcount: 1000 }], equipment: [] },
      { workDate: '2026-12-25', manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 1, actualHeadcount: 0 }], equipment: [] },
    ]);

    expect(res).toEqual({ ok: false, error: 'out_of_window', workDate: '2026-12-25' });
    expect(repo.getDailyManpowerByShift(1, '2026-09-16', '2026-09-16')).toEqual(before);
  });

  it('commit hop le -> dem dung', async () => {
    login(ADMIN);
    const res = await commitDailyImportAction(1, [
      { workDate: '2026-09-16', manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 1000, actualHeadcount: 1000 }], equipment: [] },
    ]);
    expect(res).toEqual({ ok: true, days: 1, created: 0, updated: 1, unchanged: 0 });
  });

  it('import doi so ngay hom qua da co san, khong ly do -> reason_required + workDate, khong ghi gi', async () => {
    login(ADMIN);
    const before = repo.getDailyManpowerByShift(1, '2026-09-15', '2026-09-15');

    const res = await commitDailyImportAction(1, [
      { workDate: '2026-09-15', manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 1000, actualHeadcount: 1000 }], equipment: [] },
    ]);

    expect(res).toEqual({ ok: false, error: 'reason_required', workDate: '2026-09-15' });
    expect(repo.getDailyManpowerByShift(1, '2026-09-15', '2026-09-15')).toEqual(before);
  });

  it('import doi so ngay hom qua kem ly do (>=5 ky tu) -> ok, audit ghi dung note', async () => {
    login(ADMIN);
    const res = await commitDailyImportAction(1, [
      { workDate: '2026-09-15', manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 1000, actualHeadcount: 1000 }], equipment: [] },
    ], 'sửa từ file import');

    expect(res).toEqual({ ok: true, days: 1, created: 0, updated: 1, unchanged: 0 });
    const last = repo.getAuditLog().find((a) => a.tableName === 'fact_daily_manpower')!;
    expect(last.note).toBe('sửa từ file import');
  });
});
