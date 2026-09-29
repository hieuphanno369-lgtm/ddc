import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import ExcelJS from 'exceljs';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';
import type { PortfolioKpis, ProjectSummary } from '@/server/queries';

/**
 * Trang /report + route /api/report/export (mới): nguồn data chung getReportData().
 * - Route phải chặn 403 cho viewer / data-entry / chưa đăng nhập (chỉ admin + bod).
 * - File Excel phải có đủ 3 sheet, header đậm nền navy, và cột SPI/CPI để trống
 *   khi dự án không có fact tháng (biên dữ liệu kế hoạch đã nêu tên).
 * Cache (kpis/watchlist) được mock vì tầng đó không thuộc thay đổi này; repo dùng
 * mock-repo thật để hành vi rows/backlog chạy qua code thật.
 */
const KPIS: PortfolioKpis = {
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
};

const summary = (over: Partial<ProjectSummary> & { id: number; priority: ProjectSummary['priority']; penalty: ProjectSummary['penalty'] }): ProjectSummary => ({
  masterCode: `M-${over.id}`,
  currentAliasCode: `DA-${over.id}`,
  projectName: `Dự án ${over.id}`,
  customerId: 1,
  customerName: 'KH',
  teamName: 'KD1',
  teamKdId: 1,
  projectType: 'Nha_xuong',
  marketCode: 'TN',
  status: 'Dang_trien_khai',
  onTrack: true,
  contractValue: 100,
  tonnage: 10,
  pctPlan: 50,
  pctActual: 40,
  spi: 0.8,
  cpi: 0.9,
  eac: null,
  vac: null,
  bottleneckStage: null,
  dataState: { kind: 'current', month: '2026-09' },
  ...over,
});

const WATCHLIST: ProjectSummary[] = [
  summary({ id: 1, priority: 'P0', penalty: 'risk' }),
  summary({ id: 2, priority: 'P0', penalty: 'penalized' }),
  summary({ id: 3, priority: 'P0', penalty: 'none' }), // P0 nhưng không rủi ro → KHÔNG vào p0Red
  summary({ id: 4, priority: 'P1', penalty: 'risk' }), // rủi ro nhưng không P0 → KHÔNG vào p0Red
];

vi.mock('@/server/cache', () => ({
  loadPortfolioKpis: vi.fn(async () => KPIS),
  loadWatchlist: vi.fn(async () => WATCHLIST),
}));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { getReportData } from '@/server/report';
import { getProjectSummaries } from '@/server/queries';
import { defaultOverviewPeriod, parsePeriod } from '@/lib/period';
import { todayIso } from '@/lib/clock';
import { GET } from '../../app/api/report/export/route';

const MONTH = '2026-09';
const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const DATA_ENTRY: CurrentUser = { name: 'Dev', email: 'dev@localhost', role: 'data-entry', canViewFinance: false };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

async function loadSheetNames(res: Response) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  return wb;
}

describe('getReportData - nguồn data của /report + export', () => {
  beforeEach(() => repo.reset());
  afterEach(() => repo.reset());

  it('p0Red chỉ gồm dự án P0 đang nguy cơ phạt hoặc đã bị phạt', async () => {
    const { p0Red, kpis } = await getReportData(MONTH);

    expect(p0Red.map((w) => w.id).sort()).toEqual([1, 2]);
    expect(kpis).toBe(KPIS);
  });

  it('R1: rows chỉ gồm dự án thuộc kỳ (cùng tập với Tổng quan), SPI/CPI làm tròn 2 số', async () => {
    const { rows } = await getReportData(MONTH);

    const period = parsePeriod({ month: MONTH }, defaultOverviewPeriod(todayIso()));
    const inPeriod = await getProjectSummaries(period, {});
    expect(rows.map((r) => r.id)).toEqual(inPeriod.map((s) => s.id));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(repo.listProjects().length);
    for (const r of rows) {
      if (r.spi != null) expect(r.spi).toBe(Math.round(r.spi * 100) / 100);
      if (r.cpi != null) expect(r.cpi).toBe(Math.round(r.cpi * 100) / 100);
    }
  });

  it('dự án chưa có fact tháng này, chưa khởi công (trạng thái Chuẩn bị): spi/cpi null, pctActual 0, backlog = giá trị HĐ (P1B/T12a bước 8A-4)', async () => {
    const template = repo.listProjects()[0];
    const fresh = repo.createProject(
      {
        projectName: 'Dự án mới chưa nộp số liệu',
        customerId: template.customerId,
        teamKdId: template.teamKdId,
        marketCode: template.marketCode,
        projectType: template.projectType,
        priority: 'P1',
        contractValue: 500,
      },
      'tester',
    );

    const { rows } = await getReportData(MONTH);
    const row = rows.find((r) => r.id === fresh.id);

    expect(row).toBeDefined();
    expect(row).toMatchObject({ spi: null, cpi: null, pctActual: 0, backlog: 500, name: 'Dự án mới chưa nộp số liệu' });
  });

  it('dự án đang triển khai (đã khởi công): backlog = 0, không phải giá trị HĐ (P1B/T12a bước 8A-4)', async () => {
    const { rows } = await getReportData(MONTH);
    const inProgress = repo
      .listProjects()
      .find((p) => p.actualStartDate != null);
    expect(inProgress, 'seed phải có ít nhất 1 dự án đã khởi công').toBeDefined();

    const row = rows.find((r) => r.id === inProgress!.id);
    expect(row).toBeDefined();
    expect(row!.backlog).toBe(0);
  });
});

describe('GET /api/report/export - phân quyền và nội dung file', () => {
  beforeEach(() => repo.reset());
  afterEach(() => {
    vi.clearAllMocks();
    repo.reset();
  });

  it('admin tải được file .xlsx có 3 sheet KPI / P0-Red / DanhSachDuAn', async () => {
    login(ADMIN);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml.sheet');
    expect(res.headers.get('Content-Disposition')).toContain('bao-cao-ban-dieu-hanh.xlsx');

    const wb = await loadSheetNames(res);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['KPI', 'P0-Red', 'DanhSachDuAn']);
    expect(wb.getWorksheet('KPI')!.getRow(1).values).toEqual([undefined, 'Chỉ số', 'Giá trị']);
    expect(wb.getWorksheet('DanhSachDuAn')!.rowCount).toBe(1 + (await getReportData(MONTH)).rows.length);
  });

  it('bod tải được file (BOD có quyền xem báo cáo)', async () => {
    login(BOD);

    const res = await GET();

    expect(res.status).toBe(200);
    expect((await loadSheetNames(res)).worksheets).toHaveLength(3);
  });

  it('header mỗi sheet in đậm, chữ trắng, nền navy FF0A1F3D', async () => {
    login(ADMIN);

    const wb = await loadSheetNames(await GET());

    for (const name of ['KPI', 'P0-Red', 'DanhSachDuAn']) {
      const header = wb.getWorksheet(name)!.getRow(1);
      expect(header.font.bold, `${name} bold`).toBe(true);
      expect(header.font.color?.argb, `${name} font color`).toBe('FFFFFFFF');
      expect(header.fill, `${name} fill`).toMatchObject({
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0A1F3D' },
      });
    }
  });

  it('dự án không có fact: ô SPI/CPI để trống thay vì null/NaN', async () => {
    const template = repo.listProjects()[0];
    repo.createProject(
      {
        projectName: 'Dự án mới chưa nộp số liệu',
        customerId: template.customerId,
        teamKdId: template.teamKdId,
        marketCode: template.marketCode,
        projectType: template.projectType,
        priority: 'P1',
        contractValue: 500,
      },
      'tester',
    );
    login(ADMIN);

    const wb = await loadSheetNames(await GET());
    const ws = wb.getWorksheet('DanhSachDuAn')!;
    const row = ws.getRow(ws.rowCount);

    expect(row.getCell(2).value).toBe('Dự án mới chưa nộp số liệu');
    expect(row.getCell(3).value ?? '').toBe('');
    expect(row.getCell(4).value ?? '').toBe('');
    expect(row.getCell(5).value).toBe(0);
  });

  it('p0Red rỗng thì sheet P0-Red chỉ còn dòng header', async () => {
    const cache = await import('@/server/cache');
    vi.mocked(cache.loadWatchlist).mockResolvedValueOnce([]);
    login(ADMIN);

    const wb = await loadSheetNames(await GET());
    const ws = wb.getWorksheet('P0-Red')!;

    expect(ws.rowCount).toBe(1);
  });

  describe('trường hợp phải thất bại: 403 Forbidden', () => {
    it('viewer bị chặn 403 và không nhận được file', async () => {
      login(VIEWER);

      const res = await GET();

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Forbidden' });
    });

    it('data-entry bị chặn 403 dù là PIC', async () => {
      login(DATA_ENTRY);

      const res = await GET();

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Forbidden' });
    });

    it('chưa đăng nhập bị chặn 403', async () => {
      login(null);

      const res = await GET();

      expect(res.status).toBe(403);
    });
  });
});
