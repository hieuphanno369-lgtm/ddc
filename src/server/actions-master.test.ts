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
import { saveFactoryAction, setFactoryActiveAction } from '@/server/actions-master';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

beforeEach(() => {
  repo.reset();
  vi.clearAllMocks();
});

describe('saveFactoryAction', () => {
  it('admin tao khu vuc moi -> ok', async () => {
    login(ADMIN);
    const res = await saveFactoryAction({ name: 'Nhà máy Cần Thơ', region: 'Miền Tây', capacityTonPerYear: 20000 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(repo.getDims().factories.find((f) => f.id === res.id)?.name).toBe('Nhà máy Cần Thơ');
  });

  it('admin sua khu vuc co san -> ok', async () => {
    login(ADMIN);
    const res = await saveFactoryAction({ id: 1, name: 'Nhà máy Đồng Nai 2', region: 'Miền Nam', capacityTonPerYear: 61000 });
    expect(res).toEqual({ ok: true, id: 1 });
    expect(repo.getDims().factories.find((f) => f.id === 1)?.name).toBe('Nhà máy Đồng Nai 2');
  });

  it('trung ten (khac hoa thuong) -> duplicate_name', async () => {
    login(ADMIN);
    const uniqueName = `Nhà máy kiểm thử ${Date.now()}`;
    const created = await saveFactoryAction({ name: uniqueName, region: '', capacityTonPerYear: 1000 });
    expect(created.ok).toBe(true);

    const res = await saveFactoryAction({ name: uniqueName.toUpperCase(), region: '', capacityTonPerYear: 500 });
    expect(res).toEqual({ ok: false, error: 'duplicate_name' });
  });

  it('capacity 0 -> Invalid input', async () => {
    login(ADMIN);
    const res = await saveFactoryAction({ name: 'X', region: '', capacityTonPerYear: 0 });
    expect(res).toEqual({ ok: false, error: 'Invalid input' });
  });

  it('data-entry, bod, viewer -> Forbidden', async () => {
    for (const u of [dataEntry('pm@daidung.com.vn'), BOD, VIEWER]) {
      login(u);
      const res = await saveFactoryAction({ name: 'X', region: '', capacityTonPerYear: 100 });
      expect(res).toEqual({ ok: false, error: 'Forbidden' });
    }
  });
});

describe('setFactoryActiveAction', () => {
  it('admin ngung dung roi dung lai -> ok', async () => {
    login(ADMIN);
    expect(await setFactoryActiveAction(1, false)).toEqual({ ok: true });
    expect(repo.getDims().factories.find((f) => f.id === 1)?.isActive).toBe(false);
    expect(await setFactoryActiveAction(1, true)).toEqual({ ok: true });
  });

  it('id khong ton tai -> Not found', async () => {
    login(ADMIN);
    const res = await setFactoryActiveAction(999999, false);
    expect(res).toEqual({ ok: false, error: 'Not found' });
  });

  it('data-entry -> Forbidden', async () => {
    login(dataEntry('pm@daidung.com.vn'));
    const res = await setFactoryActiveAction(1, false);
    expect(res).toEqual({ ok: false, error: 'Forbidden' });
  });
});
