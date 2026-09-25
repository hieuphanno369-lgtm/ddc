import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import type { CurrentUser } from '@/lib/session';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { getCurrentUser } from '@/lib/session';
import { GET } from '../../app/api/templates/daily-resources/route';

const req = (query: string) => new NextRequest(`http://localhost/api/templates/daily-resources${query}`);
const login = (u: CurrentUser | null) => (getCurrentUser as Mock).mockResolvedValue(u);

const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
const PIC: CurrentUser = { name: 'PM', email: 'pm@daidung.com.vn', role: 'data-entry', canViewFinance: false };
const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/templates/daily-resources', () => {
  it('chua dang nhap -> 403', async () => {
    login(null);
    const res = await GET(req('?project=1'));
    expect(res.status).toBe(403);
  });

  it('viewer -> 403', async () => {
    login(VIEWER);
    const res = await GET(req('?project=1'));
    expect(res.status).toBe(403);
  });

  it('data-entry khong gan du an -> 403', async () => {
    login(PIC);
    const res = await GET(req('?project=16'));
    expect(res.status).toBe(403);
  });

  it('PIC -> 200 + content-type spreadsheet', async () => {
    login(PIC);
    const res = await GET(req('?project=1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it("project=abc -> 400", async () => {
    login(ADMIN);
    const res = await GET(req('?project=abc'));
    expect(res.status).toBe(400);
  });

  it('admin du an 999999 -> 404', async () => {
    login(ADMIN);
    const res = await GET(req('?project=999999'));
    expect(res.status).toBe(404);
  });
});
