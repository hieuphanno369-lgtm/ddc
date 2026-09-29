import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import type { CurrentUser } from '@/lib/session';
import type { PortfolioKpis } from '@/server/queries';

/**
 * N-3 (Task 2) - /api/export va /api/report/export bo cot/dong tien khi user.canViewFinance=false.
 * Boilerplate khuon export-route.test.ts + report-export-route.test.ts.
 */
const { KPIS } = vi.hoisted(() => ({
  KPIS: {
    projectsInPeriod: 17,
    inProgress: 11,
    behindSchedule: 4,
    penaltyRisk: 3,
    penalized: 1,
    notStartedValue: 250,
  revenueInPeriod: 0,
  tonnageInPeriod: 0,
  asOfDate: '2026-09-16',
  months: ['2026-09'],
    delta: { projectsInPeriod: 1, inProgress: 0, behindSchedule: -1, penaltyRisk: 0, penalized: 0, notStartedValue: 10, revenueInPeriod: 0, tonnageInPeriod: 0 },
  } as PortfolioKpis,
}));

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
// giu nguyen getProjectSummaries that (dung cho /api/report/export ben duoi qua server/report.ts),
// chi mock rieng exportProjects (dung cho /api/export).
vi.mock('@/server/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/queries')>();
  return { ...actual, exportProjects: vi.fn() };
});
vi.mock('@/server/cache', () => ({
  loadPortfolioKpis: vi.fn(async () => KPIS),
  loadWatchlist: vi.fn(async () => []),
}));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { getCurrentUser } from '@/lib/session';
import { exportProjects } from '@/server/queries';
import { repo } from '@/server/repo/mock-repo';
import { GET as GET_EXPORT } from '../../app/api/export/route';
import { GET as GET_REPORT_EXPORT } from '../../app/api/report/export/route';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const BOD_NO_FINANCE: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: false };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

const ROW = {
  currentAliasCode: 'DA-1',
  projectName: 'Du an X',
  customerName: 'KH',
  teamName: 'KD1',
  projectType: 'Nha_xuong',
  marketCode: 'TN',
  status: 'Dang_trien_khai',
  priority: 'P0',
  pctPlan: 50,
  pctActual: 40,
  spi: 0.8,
  cpi: 0.9,
  eac: 120,
  contractValue: 100,
};

async function loadWorkbook(res: Response) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  return wb;
}

afterEach(() => vi.clearAllMocks());

describe('GET /api/export - N-3 bo cot tien khi khong quyen tai chinh', () => {
  it('BOD canViewFinance=false: khong co cot EAC / Gia tri HD; sort=value bi ep ve priority', async () => {
    login(BOD_NO_FINANCE);
    vi.mocked(exportProjects).mockResolvedValueOnce([ROW] as never);

    const res = await GET_EXPORT(new NextRequest('http://localhost/api/export?sort=value'));

    expect(res.status).toBe(200);
    const header = (await loadWorkbook(res)).worksheets[0].getRow(1).values as unknown[];
    expect(header).not.toContain('EAC');
    expect(header).not.toContain('Giá trị HĐ (tỷ)');
    expect(exportProjects).toHaveBeenCalledWith(expect.objectContaining({ sort: 'priority' }));
  });

  it('admin: co du 2 cot EAC va Gia tri HD', async () => {
    login(ADMIN);
    vi.mocked(exportProjects).mockResolvedValueOnce([ROW] as never);

    const res = await GET_EXPORT(new NextRequest('http://localhost/api/export'));

    const header = (await loadWorkbook(res)).worksheets[0].getRow(1).values as unknown[];
    expect(header).toContain('EAC');
    expect(header).toContain('Giá trị HĐ (tỷ)');
  });
});

describe('GET /api/report/export - N-3 bo dong/cot Backlog khi khong quyen tai chinh', () => {
  beforeEach(() => repo.reset());
  afterEach(() => repo.reset());

  it('BOD canViewFinance=false: sheet KPI khong co Backlog, sheet DanhSachDuAn khong co tieu de Backlog', async () => {
    login(BOD_NO_FINANCE);

    const wb = await loadWorkbook(await GET_REPORT_EXPORT());

    const kpiLabels = wb.getWorksheet('KPI')!.getColumn(1).values as unknown[];
    expect(kpiLabels).not.toContain('Backlog (tỷ)');
    const listHeader = wb.getWorksheet('DanhSachDuAn')!.getRow(1).values as unknown[];
    expect(listHeader).not.toContain('Backlog (tỷ)');
  });

  it('admin: sheet KPI va DanhSachDuAn co Backlog', async () => {
    login(ADMIN);

    const wb = await loadWorkbook(await GET_REPORT_EXPORT());

    const kpiLabels = wb.getWorksheet('KPI')!.getColumn(1).values as unknown[];
    expect(kpiLabels).toContain('Backlog (tỷ)');
    const listHeader = wb.getWorksheet('DanhSachDuAn')!.getRow(1).values as unknown[];
    expect(listHeader).toContain('Backlog (tỷ)');
  });
});
