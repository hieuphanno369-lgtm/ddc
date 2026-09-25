import { describe, expect, it } from 'vitest';
import { isBehindSchedule, selectTopPriority } from './top-priority';
import type { ProjectSummary } from '@/server/queries';

/**
 * QA doc lap cho T2 "Top du an trong diem" - du lieu khac coder (top-priority.test.ts), them
 * kiem tra khong dung sort on dinh sai (P0 khac trang thai bi loai het, khong con sot).
 */
type Sum = Pick<ProjectSummary, 'priority' | 'status' | 'onTrack' | 'pctActual' | 'projectName'>;
function proj(over: Partial<Sum>): Sum {
  return { priority: 'P0', status: 'Dang_trien_khai', onTrack: true, pctActual: 0.5, projectName: 'X', ...over };
}

describe('QA selectTopPriority - duong chay thuan loi', () => {
  it('5 du an P0 dang trien khai, 2 tre (onTrack=false) -> ca 2 dung dau, sap theo %TT tang', () => {
    const list: Sum[] = [
      proj({ projectName: 'Cham', onTrack: false, pctActual: 0.8 }),
      proj({ projectName: 'Nhanh', onTrack: true, pctActual: 0.1 }),
      proj({ projectName: 'Tre1', onTrack: false, pctActual: 0.2 }),
      proj({ projectName: 'Giua', onTrack: true, pctActual: 0.5 }),
      proj({ projectName: 'Tre2', onTrack: false, pctActual: 0.5 }),
    ];
    const out = selectTopPriority(list).map((s) => s.projectName);
    // 3 du an tre (onTrack=false) truoc theo %TT tang: Tre1(0.2), Tre2(0.5), Cham(0.8)
    // roi den 2 du an dung tien do theo %TT tang: Nhanh(0.1), Giua(0.5)
    expect(out).toEqual(['Tre1', 'Tre2', 'Cham', 'Nhanh', 'Giua']);
  });
});

describe('QA selectTopPriority - cac truong hop bien nam trong ke hoach', () => {
  it('loai het P1/P2/P3 va moi trang thai khac Dang_trien_khai cua P0, kho co du an nao lot', () => {
    const list: Sum[] = [
      proj({ priority: 'P1', status: 'Dang_trien_khai' }),
      proj({ priority: 'P2', status: 'Dang_trien_khai' }),
      proj({ priority: 'P3', status: 'Dang_trien_khai' }),
      proj({ priority: 'P0', status: 'Chuan_bi' }),
      proj({ priority: 'P0', status: 'Hoan_thanh' }),
      proj({ priority: 'P0', status: 'Tam_dung' }),
    ];
    expect(selectTopPriority(list)).toEqual([]);
  });

  it('P0 dang trien khai nhung onTrack null/undefined (du lieu thieu) -> khong throw, van xep vao nhom "khong xac dinh la tre"', () => {
    const list: Sum[] = [proj({ onTrack: undefined as unknown as boolean })];
    expect(() => selectTopPriority(list)).not.toThrow();
    // onTrack falsy (undefined) -> !onTrack = true -> isBehindSchedule = true theo dinh nghia hien tai.
    expect(isBehindSchedule(list[0])).toBe(true);
  });

  it('trung ca 3 tieu chi (tre, pctActual, ten giong het) -> khong loi, giu ca 2 (khong bi de len nhau)', () => {
    const a = proj({ projectName: 'Trung', onTrack: false, pctActual: 0.4 });
    const b = proj({ projectName: 'Trung', onTrack: false, pctActual: 0.4 });
    expect(selectTopPriority([a, b])).toHaveLength(2);
  });
});

describe('QA - truong hop PHAI THAT BAI (sort dung dinh nghia KPI, khong duoc doi tieu chi ngam)', () => {
  it('KHONG duoc sap theo pctActual GIAM dan (sai voi hop dong) - phai la TANG dan', () => {
    const list: Sum[] = [
      proj({ projectName: 'Thap', onTrack: true, pctActual: 0.1 }),
      proj({ projectName: 'Cao', onTrack: true, pctActual: 0.9 }),
    ];
    const out = selectTopPriority(list).map((s) => s.projectName);
    expect(out).toEqual(['Thap', 'Cao']); // tang dan
    expect(out).not.toEqual(['Cao', 'Thap']); // neu code doi thanh giam dan la sai hop dong
  });
});

describe('QA isBehindSchedule - dung dinh nghia KPI "Tre tien do" (queries.ts kpisForMonth)', () => {
  it('Tam_dung + onTrack false -> khong tinh la tre (chi Dang_trien_khai moi tinh)', () => {
    expect(isBehindSchedule({ status: 'Tam_dung', onTrack: false })).toBe(false);
  });
  it('Dang_trien_khai + onTrack true -> khong tre', () => {
    expect(isBehindSchedule({ status: 'Dang_trien_khai', onTrack: true })).toBe(false);
  });
});
