import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { getProjectSummaries } from './queries';
import { selectTopPriority } from '@/lib/top-priority';
import { getTopPriority } from './top-priority-queries';

describe('getTopPriority', () => {
  it('moi phan tu la P0 dang trien khai, bang dung selectTopPriority(getProjectSummaries)', async () => {
    const out = await getTopPriority('2026-09');
    for (const s of out) {
      expect(s.priority).toBe('P0');
      expect(s.status).toBe('Dang_trien_khai');
    }
    const expected = selectTopPriority(await getProjectSummaries('2026-09'));
    expect(out).toEqual(expected);
  });

  it('loc theo filters (priority P1) -> rong', async () => {
    const out = await getTopPriority('2026-09', { priority: 'P1' });
    expect(out).toEqual([]);
  });
});
