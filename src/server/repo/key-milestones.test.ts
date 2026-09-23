import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from './mock-repo';

beforeEach(() => repo.reset());

describe('replaceKeyMilestones (mock-repo)', () => {
  it('thay toan bo bo moc, sortOrder theo thu tu mang, id khong trung', () => {
    repo.replaceKeyMilestones(1, [
      { name: 'B', plannedDate: '2026-10-01', actualDate: null },
      { name: 'A', plannedDate: '2026-09-01', actualDate: '2026-09-02' },
    ], 'admin@x');
    const rows = repo.getKeyMilestones(1);
    expect(rows.map((m) => [m.name, m.sortOrder])).toEqual([['B', 1], ['A', 2]]);
    expect(new Set(rows.map((m) => m.id)).size).toBe(rows.length);
  });

  it('chi doi du an duoc goi, du an khac khong bi anh huong', () => {
    repo.replaceKeyMilestones(2, [{ name: 'X', plannedDate: '2026-10-01', actualDate: null }], 'admin@x');
    expect(repo.getKeyMilestones(1)).toHaveLength(5);
  });

  it('mang rong -> xoa het moc', () => {
    repo.replaceKeyMilestones(1, [], 'admin@x');
    expect(repo.getKeyMilestones(1)).toEqual([]);
  });

  it('ghi audit log dung tableName/recordId/field/changedBy + oldValue co du lieu cu', () => {
    repo.replaceKeyMilestones(1, [], 'admin@x');
    const entry = repo.getAuditLog()[0];
    expect(entry.tableName).toBe('project_key_milestone');
    expect(entry.recordId).toBe('1');
    expect(entry.field).toBe('replace');
    expect(entry.oldValue).toContain('Duyệt thiết kế kỹ thuật|2026-01-15|2026-01-18');
    expect(entry.changedBy).toBe('admin@x');
  });
});
