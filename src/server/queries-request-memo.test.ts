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

  it('cung tham chieu period + cung tham chieu filters: chi doc repo 1 lan, tra cung ket qua', async () => {
    const spy = vi.spyOn(repo, 'listProjects');
    const period = { from: '2031-01-01', to: '2031-01-31' };
    const filters = { status: 'all' as const };
    const a = await getProjectSummaries(period, filters);
    const b = await getProjectSummaries(period, filters);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it('khac tham chieu period: doc lai; cung period nhung khac filters: dung lai nen (khong doc lai) va ket qua theo filters moi', async () => {
    const spy = vi.spyOn(repo, 'listProjects');
    const p1 = { from: '2031-02-01', to: '2031-02-28' };
    const p2 = { from: '2031-03-01', to: '2031-03-31' };
    await getProjectSummaries(p1);
    await getProjectSummaries(p2);
    expect(spy).toHaveBeenCalledTimes(2);
    const all = await getProjectSummaries(p2, { status: 'all' });
    const none = await getProjectSummaries(p2, { status: 'Hoan_thanh' });
    expect(spy).toHaveBeenCalledTimes(2); // nen theo period da memo, filters chi loc them
    expect(none.every((s) => s.status === 'Hoan_thanh')).toBe(true);
    expect(none.length).toBeLessThanOrEqual(all.length);
  });
});
