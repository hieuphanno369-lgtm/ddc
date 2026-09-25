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
import { setUserCanViewFinanceAction } from '@/server/actions-user-finance';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('setUserCanViewFinanceAction - Q6', () => {
  it('admin tat quyen tai chinh cho bod (khong phai data-entry) -> ok, ghi audit_log', async () => {
    login(ADMIN);
    const before = repo.getUserRoles().find((u) => u.email === 'bod@daidung.com.vn');
    expect(before?.canViewFinance).toBe(true);

    const res = await setUserCanViewFinanceAction('bod@daidung.com.vn', false);
    expect(res).toEqual({ ok: true });
    expect(repo.getUserRoles().find((u) => u.email === 'bod@daidung.com.vn')?.canViewFinance).toBe(false);
    expect(
      repo
        .getAuditLog()
        .some((a) => a.tableName === 'user_roles' && a.recordId === 'bod@daidung.com.vn' && a.field === 'canViewFinance'),
    ).toBe(true);
  });

  it('[T-1] admin KHONG tat duoc quyen tai chinh cho data-entry -> DataEntryLocked, KHONG doi DB', async () => {
    login(ADMIN);
    const before = repo.getUserRoles().find((u) => u.email === 'pm@daidung.com.vn')?.canViewFinance;
    expect(before).toBe(true);

    const res = await setUserCanViewFinanceAction('pm@daidung.com.vn', false);
    expect(res).toEqual({ ok: false, error: 'DataEntryLocked' });
    expect(repo.getUserRoles().find((u) => u.email === 'pm@daidung.com.vn')?.canViewFinance).toBe(before);
  });

  it('[T-1] admin bat lai (true) cho data-entry van OK - chi khoa chieu tat', async () => {
    login(ADMIN);
    const res = await setUserCanViewFinanceAction('pm@daidung.com.vn', true);
    expect(res).toEqual({ ok: true });
  });

  it('admin bat lai cho viewer -> ok', async () => {
    login(ADMIN);
    const res = await setUserCanViewFinanceAction('viewer@daidung.com.vn', true);
    expect(res).toEqual({ ok: true });
    expect(repo.getUserRoles().find((u) => u.email === 'viewer@daidung.com.vn')?.canViewFinance).toBe(true);
  });

  it('tai khoan khong ton tai -> Not found', async () => {
    login(ADMIN);
    const res = await setUserCanViewFinanceAction('khong-ton-tai@daidung.com.vn', true);
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });

  it('email rong/khong hop le -> Invalid input', async () => {
    login(ADMIN);
    expect(await setUserCanViewFinanceAction('', true)).toEqual({ ok: false, error: 'Invalid input' });
    expect(await setUserCanViewFinanceAction('khong-phai-email', true)).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('L-4 (danh-gia-bao-mat.md): canViewFinance khong phai boolean -> Invalid input, khong nem loi/500', async () => {
    login(ADMIN);
    for (const bad of ['true', 1, null, undefined, {}, []] as never[]) {
      const res = await setUserCanViewFinanceAction('bod@daidung.com.vn', bad);
      expect(res).toEqual({ ok: false, error: 'Invalid input' });
    }
    // Khong doi DB.
    expect(repo.getUserRoles().find((u) => u.email === 'bod@daidung.com.vn')?.canViewFinance).toBe(true);
  });

  it('bod, data-entry, viewer, chua dang nhap -> Forbidden', async () => {
    for (const u of [BOD, dataEntry('pm@daidung.com.vn'), VIEWER, null]) {
      login(u);
      const res = await setUserCanViewFinanceAction('viewer@daidung.com.vn', true);
      expect(res).toEqual({ ok: false, error: 'Forbidden' });
    }
  });
});
