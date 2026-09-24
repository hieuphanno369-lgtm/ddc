import { describe, expect, it, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import type { CurrentUser } from '@/lib/session';

/**
 * Task 7 (P1A) - /api/export phải bắt đăng nhập admin/bod (giống /api/report/export) và
 * chống chèn công thức Excel (an toàn giống mẫu report-export-route.test.ts).
 */
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/server/queries', () => ({ exportProjects: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { exportProjects } from '@/server/queries';
import { GET } from '../../app/api/export/route';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const DATA_ENTRY: CurrentUser = { name: 'Dev', email: 'dev@localhost', role: 'data-entry', canViewFinance: false };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

const req = () => new NextRequest('http://localhost/api/export');

const ROW = {
  currentAliasCode: 'DA-1',
  projectName: '=HYPERLINK("http://x")',
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
  eac: null,
  contractValue: 100,
};

describe('GET /api/export - phan quyen + chong chen cong thuc', () => {
  it('chua dang nhap -> 401', async () => {
    login(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('viewer -> 403', async () => {
    login(VIEWER);
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('data-entry -> 403', async () => {
    login(DATA_ENTRY);
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('admin -> 200 va o B2 co tien to chong cong thuc', async () => {
    login(ADMIN);
    vi.mocked(exportProjects).mockResolvedValueOnce([ROW] as never);

    const res = await GET(req());

    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    const ws = wb.worksheets[0];
    expect(ws.getRow(2).getCell(2).value).toBe('\'=HYPERLINK("http://x")');
  });

  it('bod -> 200', async () => {
    login(BOD);
    vi.mocked(exportProjects).mockResolvedValueOnce([ROW] as never);

    const res = await GET(req());

    expect(res.status).toBe(200);
  });
});
