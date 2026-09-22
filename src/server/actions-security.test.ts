import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as XLSX from 'xlsx';
import { repo } from '@/server/repo/mock-repo';
import { IMPORT_MAX_BYTES } from '@/server/validation';
import type { CurrentUser } from '@/lib/session';

/**
 * Vá lỗ hổng bảo mật pre-existing (P3/P4/P6) ở tầng server action:
 * - P3: data-entry không được ghi field tài chính dù là PIC dự án.
 * - P4: import chỉ nhận .xlsx/.xls/.csv và size ≤ 10MB (chặn trước khi parse).
 * - P6: preview import không lộ projectId dự án ngoài assignment cho data-entry.
 * Mock session + cache + repo barrel (như src/server/actions.test.ts).
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { importExcelAction, saveMonthlyData } from '@/server/actions';

const YM = '2026-09';
const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
/** pm@daidung.com.vn là PIC dự án 1, 2, 3, 5, 7, 11 - KHÔNG phải PIC dự án 16. */
const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('P3 - chỉ Admin/BOD được ghi field tài chính', () => {
  it('data-entry (PIC) gửi revenueCumulative → Forbidden, KHÔNG ghi financial', async () => {
    const id = 1;
    login(dataEntry('pm@daidung.com.vn'));
    const beforeFin = JSON.stringify(repo.getFinancial(id));

    const res = await saveMonthlyData(id, YM, { revenueCumulative: 999 });

    expect(res).toEqual({ ok: false, error: 'Forbidden' });
    expect(JSON.stringify(repo.getFinancial(id))).toBe(beforeFin);
  });

  it('data-entry (PIC) gửi field hồ sơ không tài chính → vẫn lưu được', async () => {
    login(dataEntry('pm@daidung.com.vn'));

    const res = await saveMonthlyData(1, YM, { projectName: 'TÊN ĐỔI' });

    expect(res).toEqual({ ok: true });
    expect(repo.getProject(1)!.projectName).toBe('TÊN ĐỔI');
  });

  it('admin gửi revenueCumulative → lưu được', async () => {
    login(ADMIN);

    const res = await saveMonthlyData(1, YM, { revenueCumulative: 999 });

    expect(res).toEqual({ ok: true });
  });
});

describe('P4 - import chặn size/type file', () => {
  function importForm(file: File): FormData {
    const fd = new FormData();
    fd.set('file', file);
    return fd;
  }

  it('file .txt → từ chối, không parse', async () => {
    login(ADMIN);

    const res = await importExcelAction(importForm(new File([Buffer.from('x')], 'ds.txt', { type: 'text/plain' })));

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/xlsx/i);
  });

  it('file vượt 10MB → từ chối trước khi parse', async () => {
    login(ADMIN);

    const res = await importExcelAction(
      importForm(new File([Buffer.alloc(IMPORT_MAX_BYTES + 1)], 'big.xlsx')),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/10MB/);
  });
});

describe('P6 - preview import không lộ projectId ngoài assignment (data-entry)', () => {
  /** Sinh file .xlsx thật: 1 mã thuộc dự án 11 (PIC của dev), 1 mã thuộc dự án 16 (không PIC), 1 mã lạ. */
  function xlsxForm(): FormData {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { 'mã sap': 'SAP-EV-BSN-001', 'tên dự án': 'Dự án của mình', '% TT': '50' },
      { 'mã sap': 'SAP-MBS-001', 'tên dự án': 'Dự án người khác', '% TT': '30' },
      { 'mã sap': 'SAP-UNKNOWN-999', 'tên dự án': 'Chưa map', '% TT': '10' },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const fd = new FormData();
    fd.set('file', new File([bytes], 'import.xlsx'));
    return fd;
  }

  type Result = { ok: boolean; mapped?: number; preview?: { status: string; projectId: number | null }[] };

  it('data-entry: bỏ dòng mapped thuộc dự án ngoài assignment, giữ dòng của mình + dòng chờ ghép', async () => {
    login(dataEntry('pm@daidung.com.vn'));

    const res = (await importExcelAction(xlsxForm())) as Result;

    expect(res.ok).toBe(true);
    const mappedIds = res.preview!.filter((r) => r.status === 'mapped').map((r) => r.projectId);
    expect(mappedIds).toEqual([11]);
    expect(res.preview!.some((r) => r.projectId === 16)).toBe(false);
    expect(res.preview!.some((r) => r.status === 'queued')).toBe(true);
    expect(res.mapped).toBe(1);
  });

  it('admin: thấy đủ cả 2 dòng mapped (kể cả dự án không phải PIC)', async () => {
    login(ADMIN);

    const res = (await importExcelAction(xlsxForm())) as Result;

    expect(res.ok).toBe(true);
    const mappedIds = res.preview!.filter((r) => r.status === 'mapped').map((r) => r.projectId).sort();
    expect(mappedIds).toEqual([11, 16]);
  });
});
