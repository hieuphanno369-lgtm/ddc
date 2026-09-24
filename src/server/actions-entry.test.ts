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
import { addProjectContractorAction, createContractorAction, removeProjectContractorAction } from '@/server/actions-entry';

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
