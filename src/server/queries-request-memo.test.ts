import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Nhanh memo cua `requestMemo` (queries.ts) - tu React 19, Vitest/tsx CO export `React.cache` that,
 * nhung ngoai Server Component no khong memo gi (goi thang ham goc) nen cac test khac chi chay
 * nhanh fallback. O day gia lap `cache` cua React (memo theo tung tham so, so bang Object.is -
 * dung nhu React.cache trong 1 request Server Component that) de khoa hanh vi: cung tham so -> chi
 * 1 lan doc repo; tham so khac -> doc lai, ket qua dung theo tham so moi (khong tra nham ban cu).
 */
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const cache = <A extends unknown[], R>(fn: (...args: A) => R) => {
    const memo: { args: A; value: R }[] = [];
    return (...args: A): R => {
      const hit = memo.find((m) => m.args.length === args.length && m.args.every((a, i) => Object.is(a, args[i])));
      if (hit) return hit.value;
      const value = fn(...args);
      memo.push({ args, value });
      return value;
    };
  };
  return { ...actual, cache };
});
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});

import { repo } from '@/server/repo';
import { getProjectSummaries } from './queries';

describe('requestMemo - nhanh co React.cache (T1 Buoc 11)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('cung yearMonth + cung tham chieu filters: chi doc repo 1 lan, tra cung ket qua', async () => {
    const spy = vi.spyOn(repo, 'listProjects');
    const filters = { status: 'all' as const };
    const a = await getProjectSummaries('2031-01', filters);
    const b = await getProjectSummaries('2031-01', filters);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it('khac yearMonth hoac khac tham chieu filters: doc lai (khong tra nham ket qua cu)', async () => {
    const spy = vi.spyOn(repo, 'listProjects');
    await getProjectSummaries('2031-02');
    await getProjectSummaries('2031-03');
    await getProjectSummaries('2031-03', { status: 'all' });
    await getProjectSummaries('2031-03', { status: 'all' });
    expect(spy).toHaveBeenCalledTimes(4);
  });
});
