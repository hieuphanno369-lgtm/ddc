import type { RepoData } from '@/data/seed/history';
import type { AuditLogEntry, BackfillWindow, CreateBackfillWindowInput } from './types';

export interface BackfillMockDeps {
  getData: () => RepoData;
  persist: () => void;
}

const globalForBackfill = globalThis as unknown as { __ddcBackfillMock?: BackfillWindow[] };

function store(): BackfillWindow[] {
  globalForBackfill.__ddcBackfillMock ??= [];
  return globalForBackfill.__ddcBackfillMock;
}

/** Test gọi khi cần reset kho khoảng nhập bù (khuôn `resetNotifyMock`). */
export function resetBackfillMock(): void {
  delete globalForBackfill.__ddcBackfillMock;
}

function auditMock(d: RepoData, recordId: string, field: string, oldValue: string, newValue: string, changedBy: string, note = ''): void {
  const entry: AuditLogEntry = {
    id: d.auditLog.length + 1,
    tableName: 'project_backfill_window',
    recordId,
    field,
    oldValue,
    newValue,
    changedBy,
    changedAt: new Date().toISOString(),
    note,
  };
  d.auditLog.push(entry);
}

const isActive = (w: BackfillWindow, now: Date): boolean =>
  w.disabledAt == null && (w.expiresAt == null || new Date(w.expiresAt).getTime() > now.getTime());

/** Khuôn `prisma-repo-backfill.ts` cho mock (test import thẳng `./mock-repo`). */
export function makeBackfillMockRepo({ getData }: BackfillMockDeps) {
  return {
    readActiveBackfillWindows(projectId: number, now: Date): BackfillWindow[] {
      return store()
        .filter((w) => w.projectId === projectId && isActive(w, now))
        .sort((a, b) => a.fromDate.localeCompare(b.fromDate))
        .map((w) => ({ ...w }));
    },

    listBackfillWindows(projectId: number): BackfillWindow[] {
      return store()
        .filter((w) => w.projectId === projectId)
        .sort((a, b) => b.id - a.id)
        .map((w) => ({ ...w }));
    },

    createBackfillWindow(input: CreateBackfillWindowInput, by: string): BackfillWindow | 'overlap' | 'not_found' {
      const d = getData();
      if (!d.projects.some((p) => p.id === input.projectId && p.isActive)) return 'not_found';
      const now = new Date();
      const clash = store().some(
        (w) => w.projectId === input.projectId && isActive(w, now) && w.fromDate <= input.toDate && w.toDate >= input.fromDate,
      );
      if (clash) return 'overlap';
      const id = store().reduce((m, w) => Math.max(m, w.id), 0) + 1;
      const created: BackfillWindow = {
        id,
        projectId: input.projectId,
        fromDate: input.fromDate,
        toDate: input.toDate,
        note: input.note,
        enabledBy: by,
        enabledAt: now.toISOString(),
        expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
        disabledBy: null,
        disabledAt: null,
      };
      store().push(created);
      auditMock(d, String(id), 'enable', '', `${input.fromDate}..${input.toDate}`, by, input.note);
      return { ...created };
    },

    disableBackfillWindow(id: number, by: string): 'ok' | 'not_found' | 'already' {
      const w = store().find((x) => x.id === id);
      if (!w) return 'not_found';
      if (w.disabledAt != null) return 'already';
      w.disabledAt = new Date().toISOString();
      w.disabledBy = by;
      auditMock(getData(), String(id), 'disable', `${w.fromDate}..${w.toDate}`, '', by);
      return 'ok';
    },
  };
}
