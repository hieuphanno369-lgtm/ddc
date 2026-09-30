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
      return repo.getAuditLog().filter((a) => a.tableName === 'project_backfill_window' && a.recordId === String(windowId)).length;
    },
    async reset() {
      repo.reset();
    },
  };
});
