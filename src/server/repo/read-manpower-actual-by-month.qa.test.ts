import type { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * QA doc lap cho readManpowerActualByMonth (Buoc 6, T5): kiem SQL chi loc theo projectId, bind
 * tham so (khong noi chuoi truc tiep), khong dinh kem loc nao khac. So sanh cheo voi mock repo
 * tren cung 1 bo du lieu gia de bat loi tinh toan sai (khong chi kiem "co goi ham" nhu test cua
 * coder).
 */
const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn(async (_sql: unknown): Promise<unknown[]> => []) }));
vi.mock('@/server/db', () => ({ prisma: { $queryRaw: queryRaw } }));

import { readRepoPrisma } from './read-prisma';
import { createReadMock } from './read-mock';
import type { RepoData } from '@/data/seed/history';

beforeEach(() => queryRaw.mockClear());

describe('QA readManpowerActualByMonth (read-prisma) - SQL chi bind projectId, khong ro ri du an khac', () => {
  it('goi $queryRaw dung 1 lan, sql.values CHI co dung projectId (khong co gia tri khac lot vao)', async () => {
    await readRepoPrisma.readManpowerActualByMonth(42);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.values).toEqual([42]);
  });

  it("cau SQL dung GROUP BY theo thang va COUNT(DISTINCT workDate) - khong phai COUNT(*) (se dem trung ca/nha thau)", async () => {
    await readRepoPrisma.readManpowerActualByMonth(1);
    const sql = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.sql).toMatch(/COUNT\(DISTINCT\s+m\."workDate"\)/);
    expect(sql.sql).toMatch(/SUM\(m\."actualHeadcount"\)/);
    expect(sql.sql).toMatch(/WHERE m\."projectId"\s*=\s*\?/);
  });

  it('goi 2 du an khac nhau -> 2 lan goi doc lap, moi lan chi mang đung projectId cua no', async () => {
    await readRepoPrisma.readManpowerActualByMonth(1);
    await readRepoPrisma.readManpowerActualByMonth(2);
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect((queryRaw.mock.calls[0][0] as Prisma.Sql).values).toEqual([1]);
    expect((queryRaw.mock.calls[1][0] as Prisma.Sql).values).toEqual([2]);
  });
});

describe('QA readManpowerActualByMonth (read-mock) - tu tinh tay tren bo du lieu gia doc lap', () => {
  it('2 nha thau, 2 ca, 1 ngay trung nhau trong thang -> cong dung actualSum, days dem ngay KHAC nhau (khong dem dong)', async () => {
    const data = {
      dailyManpowerShifts: [
        { projectId: 5, workDate: '2026-03-01', shiftCode: 'morning', contractorId: 1, actualHeadcount: 10 },
        { projectId: 5, workDate: '2026-03-01', shiftCode: 'evening', contractorId: 1, actualHeadcount: 4 },
        { projectId: 5, workDate: '2026-03-01', shiftCode: 'morning', contractorId: 2, actualHeadcount: 6 },
        { projectId: 5, workDate: '2026-03-02', shiftCode: 'morning', contractorId: 1, actualHeadcount: 8 },
        { projectId: 5, workDate: '2026-04-15', shiftCode: 'morning', contractorId: 1, actualHeadcount: 3 },
        { projectId: 99, workDate: '2026-03-01', shiftCode: 'morning', contractorId: 1, actualHeadcount: 999 }, // du an khac
      ],
    } as unknown as RepoData;
    const mock = createReadMock(() => data);
    const rows = await mock.readManpowerActualByMonth(5);
    expect(rows).toEqual([
      { yearMonth: '2026-03', actualSum: 28, days: 2 }, // 10+4+6+8 = 28; ngay khac nhau: 01, 02 -> 2 (KHONG phai 4 dong)
      { yearMonth: '2026-04', actualSum: 3, days: 1 },
    ]);
  });

  it('du an khong ton tai (99999) -> mang rong, khong throw', async () => {
    const data = { dailyManpowerShifts: [] } as unknown as RepoData;
    const mock = createReadMock(() => data);
    await expect(mock.readManpowerActualByMonth(99999)).resolves.toEqual([]);
  });
});
