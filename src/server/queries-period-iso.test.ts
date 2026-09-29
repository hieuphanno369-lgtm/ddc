import { describe, expect, it, vi } from 'vitest';

/**
 * P4 tester - Postgres trả ngày dự án dạng ISO đầy đủ ("2026-06-20T00:00:00.000Z"), còn mock trả "2026-06-20".
 * Mọi phép so ngày ở queries.ts phải dùng phần ngày (slice(0,10)) nên kết quả PHẢI giống hệt bản mock, kể cả khi
 * ngày thực tế đúng bằng ngày mốc. Ở đây bọc repo của fixture để đổi mọi trường ngày sang ISO đầy đủ.
 */
vi.mock('@/server/repo', async () => {
  const fx = await import('./queries-period.fixture');
  const DATE_FIELDS = [
    'contractDate', 'plannedStartDate', 'plannedFinishDate', 'committedHandoverDate', 'actualStartDate', 'actualFinishDate',
  ] as const;
  const iso = <T extends object>(p: T | undefined): T | undefined => {
    if (!p) return p;
    const out = { ...p } as Record<string, unknown>;
    for (const f of DATE_FIELDS) if (typeof out[f] === 'string') out[f] = `${(out[f] as string).slice(0, 10)}T00:00:00.000Z`;
    return out as T;
  };
  return {
    repo: {
      ...fx.repo,
      async listProjects() { return (await fx.repo.listProjects()).map((p) => iso(p)!); },
      async getProject(id: number) { return iso(await fx.repo.getProject(id)); },
    },
  };
});

import type { Period } from '@/lib/period';
import { getPortfolioKpis, getProjectSummaries, type ProjectSummary } from './queries';

const per = (from: string, to: string): Period => ({ from, to });
const byName = (rows: ProjectSummary[], name: string) => rows.find((r) => r.projectName === name);

describe('P4 ngày ISO đầy đủ từ Postgres: kết quả giống hệt bản mock, kể cả khi ngày đúng bằng ngày mốc', () => {
  it('kiểm chứng bọc repo: dự án B thật sự trả ngày dạng ISO đầy đủ', async () => {
    const { repo } = await import('@/server/repo');
    expect((await repo.getProject(102))!.actualFinishDate).toBe('2026-06-20T00:00:00.000Z');
  });

  it('L-1a với ISO: %KH của A tại 2026-03-31 vẫn là 89/364', async () => {
    const a = byName(await getProjectSummaries(per('2026-03-01', '2026-03-31')), 'A')!;
    expect(a.pctPlan).toBeCloseTo(89 / 364, 3);
  });

  it('ngày kết thúc thực tế B (06-20) đúng bằng mốc: Hoan_thanh', async () => {
    const b = byName(await getProjectSummaries(per('2026-06-01', '2026-06-20')), 'B')!;
    expect(b.status).toBe('Hoan_thanh');
  });

  it('mốc trước ngày kết thúc 1 ngày (06-19): chưa hoàn thành (ngày thực tế sau mốc coi như chưa xảy ra)', async () => {
    const b = byName(await getProjectSummaries(per('2026-06-01', '2026-06-19')), 'B')!;
    expect(b.status).toBe('Dang_trien_khai');
  });

  it('ngày bắt đầu thực tế của A (01-10) đúng bằng mốc: A thuộc kỳ và Dang_trien_khai; mốc 01-09 thì A chưa thuộc kỳ (start = ngày thực tế)', async () => {
    expect(byName(await getProjectSummaries(per('2026-01-01', '2026-01-10')), 'A')!.status).toBe('Dang_trien_khai');
    expect(byName(await getProjectSummaries(per('2026-01-01', '2026-01-09')), 'A')).toBeUndefined();
  });

  it('thuộc kỳ: B kết thúc 06-20, kỳ bắt đầu 06-20 vẫn tính, 06-21 thì không (so sánh ngày, không so chuỗi ISO dài)', async () => {
    expect((await getProjectSummaries(per('2026-06-20', '2026-06-30'))).map((r) => r.projectName)).toContain('B');
    expect((await getProjectSummaries(per('2026-06-21', '2026-06-30'))).map((r) => r.projectName)).not.toContain('B');
  });

  it('kỳ bắt đầu đúng ngày khởi công KH của C (2026-11-01) thì C thuộc kỳ, 2026-10-31 thì không', async () => {
    expect((await getProjectSummaries(per('2026-10-01', '2026-11-01'))).map((r) => r.projectName)).toContain('C');
    expect((await getProjectSummaries(per('2026-10-01', '2026-10-31'))).map((r) => r.projectName)).not.toContain('C');
  });

  it('HĐ chưa khởi công: ngày ký C (08-01) đúng bằng mốc thì tính (50), mốc 07-31 thì 0', async () => {
    expect((await getPortfolioKpis(per('2026-07-01', '2026-08-01'))).notStartedValue).toBe(50);
    expect((await getPortfolioKpis(per('2026-07-01', '2026-07-31'))).notStartedValue).toBe(0);
  });
});
