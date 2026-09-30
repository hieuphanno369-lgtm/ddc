import { describe, expect, it } from 'vitest';
import { runBackfillContract } from './backfill-contract';
import { repo } from './mock-repo';

/** P4 (F2) - kho nhập bù bản mock chạy bộ ca dùng chung (`backfill-contract.ts`). */
runBackfillContract('backfill repo (mock)', async () => {
  repo.reset();
  const projectId = (await repo.listProjects())[0]!.id;
  return {
    repo,
    projectId,
    async auditCount(windowId) {
      return repo.getAuditLog().filter((a) => a.tableName === 'project_backfill_window' && a.recordId === `${projectId}/${windowId}`).length;
    },
    async reset() {
      repo.reset();
    },
  };
});

describe('S-3: nhat ky nhap bu hien o the nhat ky cua dung du an', () => {
  it('bat/tat khoang hien trong readProjectAuditTrail cua du an do, khong hien o du an khac', async () => {
    repo.reset();
    const [a, b] = await repo.listProjects();
    const w = await repo.createBackfillWindow(
      { projectId: a!.id, fromDate: '2025-01-01', toDate: '2025-03-31', note: 'nhap bu', expiresAt: null },
      'admin@ddc.vn',
    );
    if (typeof w === 'string') throw new Error(`khong tao duoc khoang: ${w}`);
    await repo.disableBackfillWindow(w.id, 'admin@ddc.vn');
    const trail = (id: number) => repo.readProjectAuditTrail(id, 50).filter((x) => x.tableName === 'project_backfill_window');
    expect(trail(a!.id).map((x) => x.field).sort()).toEqual(['disable', 'enable']);
    expect(trail(b!.id)).toEqual([]);
    repo.reset();
  });
});
