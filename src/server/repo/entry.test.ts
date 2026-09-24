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

  it('saveDailyResources: o moi 0/0 khong tao dong', () => {
    const res = repo.saveDailyResources(2, '2026-09-16', {
      manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 0, actualHeadcount: 0 }],
      equipment: [],
    }, 'u@x', '');
    expect(res).toEqual({ created: 0, updated: 0, unchanged: 1 });
    expect(repo.getDailyManpowerByShift(2, '2026-09-16', '2026-09-16')).toHaveLength(0);
  });

  it('saveDailyResources: o moi 5/4 tao', () => {
    const res = repo.saveDailyResources(2, '2026-09-16', {
      manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 }],
      equipment: [],
    }, 'u@x', '');
    expect(res).toEqual({ created: 1, updated: 0, unchanged: 0 });
  });

  it('saveDailyResources: doi o co san -> 1 audit co note; gui y het -> unchanged khong audit', () => {
    const before = repo.getAuditLog().length;
    const res1 = repo.saveDailyResources(1, '2026-09-16', {
      manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 999, actualHeadcount: 999 }],
      equipment: [],
    }, 'u@x', 'ly do sua');
    expect(res1).toEqual({ created: 0, updated: 1, unchanged: 0 });
    const afterFirst = repo.getAuditLog();
    expect(afterFirst.length).toBe(before + 1);
    expect(afterFirst[0].note).toBe('ly do sua');

    const res2 = repo.saveDailyResources(1, '2026-09-16', {
      manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 999, actualHeadcount: 999 }],
      equipment: [],
    }, 'u@x', '');
    expect(res2).toEqual({ created: 0, updated: 0, unchanged: 1 });
    expect(repo.getAuditLog().length).toBe(before + 1);
  });

  it('tong qua getDailyManpower = tong cac ca', () => {
    repo.saveDailyResources(2, '2026-09-16', {
      manpower: [
        { contractorId: 1, shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 },
        { contractorId: 1, shiftCode: 'evening', plannedHeadcount: 3, actualHeadcount: 2 },
      ],
      equipment: [],
    }, 'u@x', '');
    const totals = repo.getDailyManpower(2, '2026-09-16', '2026-09-16');
    expect(totals).toEqual([{ projectId: 2, contractorId: 1, workDate: '2026-09-16', plannedHeadcount: 8, actualHeadcount: 6 }]);
  });
});
