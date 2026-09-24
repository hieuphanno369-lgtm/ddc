import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from './mock-repo';

/** Task 1 (P2A) - getShifts/getDailyManpowerByShift + logAudit/closeAlert nhận thêm note. */
describe('entry repo (mock)', () => {
  beforeEach(() => {
    repo.reset();
  });

  it('getShifts tra dung 2 ma theo thu tu morning, evening', () => {
    const shifts = repo.getShifts();
    expect(shifts.map((s) => s.code)).toEqual(['morning', 'evening']);
    expect(shifts.find((s) => s.code === 'evening')!.nameVi).toBe('Ca tối');
  });

  it('getDailyManpowerByShift ngay cuoi seed co 12 dong, tong KH 520 / TT 486', () => {
    const rows = repo.getDailyManpowerByShift(1, '2026-09-16', '2026-09-16');
    expect(rows).toHaveLength(12);
    expect(rows.reduce((a, b) => a + b.plannedHeadcount, 0)).toBe(520);
    expect(rows.reduce((a, b) => a + b.actualHeadcount, 0)).toBe(486);
  });

  it('closeAlert ghi closedBy + closeNote', () => {
    const alert = repo.getAlerts()[0];
    repo.closeAlert(alert.id, 'X', 'u@x', 'ghi chú');
    const after = repo.getAlerts().find((a) => a.id === alert.id)!;
    expect(after.closedBy).toBe('u@x');
    expect(after.closeNote).toBe('ghi chú');
  });

  it('logAudit ghi note', () => {
    repo.logAudit('demo_table', '1', 'field', 'old', 'new', 'u@x', 'lý do');
    const last = repo.getAuditLog()[0];
    expect(last.note).toBe('lý do');
  });

  it('addProjectContractor lan 2 -> exists', () => {
    expect(repo.addProjectContractor(2, 1, 'u@x')).toBe('added');
    expect(repo.addProjectContractor(2, 1, 'u@x')).toBe('exists');
  });

  it('nha thau khong ton tai -> not_found', () => {
    expect(repo.addProjectContractor(2, 999999, 'u@x')).toBe('not_found');
  });

  it('moi add/remove co 1 dong audit project_contractor', () => {
    const before = repo.getAuditLog().length;
    repo.addProjectContractor(3, 1, 'u@x');
    const afterAdd = repo.getAuditLog();
    expect(afterAdd.length).toBe(before + 1);
    expect(afterAdd[0].tableName).toBe('project_contractor');

    repo.removeProjectContractor(3, 1, 'u@x');
    const afterRemove = repo.getAuditLog();
    expect(afterRemove.length).toBe(before + 2);
    expect(afterRemove[0].tableName).toBe('project_contractor');
  });
});
