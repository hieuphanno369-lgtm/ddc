import { describe, it, expect, beforeEach } from 'vitest';
import { repo } from './mock-repo';

beforeEach(() => repo.reset());

describe('append-only facts (latest-wins)', () => {
  it('saveMonthlyFact ghi version mới + changeNote, latest thắng', () => {
    const p = repo.listProjects()[0];
    const ym = '2026-09';
    const before = repo.getLatestFact(p.id, ym)!;
    expect(before.version).toBe(1);

    repo.saveMonthlyFact(p.id, ym, { pctActual: 0.5, ac: 10 }, 'admin@daidung.com.vn');
    const after = repo.getLatestFact(p.id, ym)!;

    expect(after.version).toBe(2);
    expect(after.pctActual).toBe(0.5);
    expect(after.ac).toBe(10);
    expect(after.changeNote).toContain('pctActual');
    expect(after.changedBy).toBe('admin@daidung.com.vn');
    // getFacts chỉ trả về version mới nhất mỗi tháng
    expect(repo.getFacts(p.id).filter((f) => f.yearMonth === ym).length).toBe(1);
  });

  it('BAC snapshot: sửa contractValue không đổi fact cũ, chỉ ảnh hưởng fact mới', () => {
    const p = repo.listProjects()[0];
    const ym = '2026-09';
    const oldBac = repo.getLatestFact(p.id, ym)!.bac;

    repo.saveProjectProfile(p.id, { contractValue: oldBac + 100 }, 'admin@daidung.com.vn');

    // fact cũ giữ BAC snapshot cũ → metrics lịch sử không đổi
    expect(repo.getLatestFact(p.id, ym)!.bac).toBe(oldBac);

    // ghi fact mới → snapshot BAC mới
    const cur = repo.getLatestFact(p.id, ym)!;
    repo.saveMonthlyFact(p.id, ym, { pctActual: cur.pctActual }, 'admin@daidung.com.vn');
    expect(repo.getLatestFact(p.id, ym)!.bac).toBe(oldBac + 100);
  });

  it('saveFinancial ghi version mới', () => {
    const p = repo.listProjects()[0];
    const ym = '2026-09';
    const before = repo.getFinancial(p.id).find((f) => f.yearMonth === ym)!;
    repo.saveFinancial(p.id, ym, { revenueCumulative: 999 }, 'admin@daidung.com.vn');
    const after = repo.getFinancial(p.id).find((f) => f.yearMonth === ym)!;
    expect(after.version).toBe(before.version + 1);
    expect(after.revenueCumulative).toBe(999);
    expect(after.changeNote).toContain('revenueCumulative');
  });
});

describe('dim chuẩn hóa (customer/team)', () => {
  it('suggestDim match name + alias (case-insensitive)', () => {
    const r = repo.suggestDim('customer', 'tập đoàn vingroup');
    expect(r.some((x) => x.name === 'VinGroup')).toBe(true);
  });

  it('createDimValue dedup theo name/alias', () => {
    expect(repo.createDimValue('customer', 'Vingroup')).toBe(1); // alias → id VinGroup
    const newId = repo.createDimValue('customer', 'Khách mới XYZ');
    expect(newId).toBeGreaterThan(10);
  });

  it('mergeDimValue re-point FK + mark inactive + merge alias', () => {
    const a = repo.createDimValue('customer', 'Cty A');
    const b = repo.createDimValue('customer', 'Cty B');
    const proj = repo.listProjects()[0];
    repo.saveProjectProfile(proj.id, { customerId: a }, 'admin@daidung.com.vn');

    const moved = repo.mergeDimValue('customer', a, b);

    expect(moved).toBeGreaterThanOrEqual(1);
    expect(repo.getProject(proj.id)!.customerId).toBe(b);
    const row = repo.getDimFieldValues('customer').find((x) => x.id === a)!;
    expect(row.isActive).toBe(false);
    expect(row.mergedIntoId).toBe(b);
  });

  it('renameDimValue giữ tên cũ làm alias', () => {
    repo.renameDimValue('customer', 1, 'Vingroup Group');
    expect(repo.getDimFieldValues('customer').find((x) => x.id === 1)!.name).toBe('Vingroup Group');
    // tên cũ vẫn tìm thấy qua suggest (alias)
    expect(repo.suggestDim('customer', 'VinGroup').some((x) => x.id === 1)).toBe(true);
  });
});
