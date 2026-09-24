import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { repo } from '@/server/repo';
import { getAuditLogPage } from './audit-log-page';

const NOW = new Date('2026-09-24T00:00:00Z');
const EMPTY_PAGE = { items: [], total: 0, page: 1, totalPages: 1, pageSize: 20 };

describe('getAuditLogPage', () => {
  it('range "14d" -> truyen since dung now - 14 ngay, pageSize mac dinh 20', async () => {
    const spy = vi.spyOn(repo, 'readAuditLogPage').mockResolvedValueOnce(EMPTY_PAGE);
    await getAuditLogPage({ page: 2, range: '14d', now: NOW });
    expect(spy).toHaveBeenCalledWith({ since: new Date('2026-09-10T00:00:00Z'), page: 2, pageSize: 20 });
  });

  it('range "all" -> since null', async () => {
    const spy = vi.spyOn(repo, 'readAuditLogPage').mockResolvedValueOnce(EMPTY_PAGE);
    await getAuditLogPage({ page: 1, range: 'all', now: NOW });
    expect(spy).toHaveBeenCalledWith({ since: null, page: 1, pageSize: 20 });
  });

  it('pageSize tuy chinh -> truyen dung, khong ep 20', async () => {
    const spy = vi.spyOn(repo, 'readAuditLogPage').mockResolvedValueOnce(EMPTY_PAGE);
    await getAuditLogPage({ page: 1, range: '14d', pageSize: 5, now: NOW });
    expect(spy).toHaveBeenCalledWith({ since: new Date('2026-09-10T00:00:00Z'), page: 1, pageSize: 5 });
  });

  it('tra ve nguyen ket qua cua repo.readAuditLogPage', async () => {
    const page = { items: [], total: 45, page: 2, totalPages: 3, pageSize: 20 };
    vi.spyOn(repo, 'readAuditLogPage').mockResolvedValueOnce(page);
    const r = await getAuditLogPage({ page: 2, range: '14d', now: NOW });
    expect(r).toEqual(page);
  });
});
