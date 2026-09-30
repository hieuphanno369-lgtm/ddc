import { beforeEach, describe, expect, it } from 'vitest';
import type { BackfillWindow, CreateBackfillWindowInput } from './types';

/**
 * P4 (F2) - bộ ca dùng chung cho kho nhập bù bản mock và bản Prisma (DB thật): cùng hành vi ở cả hai.
 * Mỗi bên tự dựng `BackfillHarness`. Dữ liệu test do harness tạo/dọn.
 */
export interface BackfillHarness {
  repo: {
    readActiveBackfillWindows(projectId: number, now: Date): Promise<BackfillWindow[]> | BackfillWindow[];
    listBackfillWindows(projectId: number): Promise<BackfillWindow[]> | BackfillWindow[];
    createBackfillWindow(input: CreateBackfillWindowInput, by: string): Promise<BackfillWindow | 'overlap' | 'not_found'> | BackfillWindow | 'overlap' | 'not_found';
    disableBackfillWindow(id: number, by: string): Promise<'ok' | 'not_found' | 'already'> | 'ok' | 'not_found' | 'already';
  };
  /** Id của 1 dự án có thật để gắn khoảng. */
  projectId: number;
  /** Số dòng audit_log của bảng project_backfill_window ứng với id khoảng. */
  auditCount(windowId: number): Promise<number>;
  /** Dọn mọi khoảng test. */
  reset(): Promise<void>;
}

const input = (projectId: number, over: Partial<CreateBackfillWindowInput> = {}): CreateBackfillWindowInput => ({
  projectId,
  fromDate: '2026-01-01',
  toDate: '2026-06-30',
  note: 'nhap bu test-p4',
  expiresAt: null,
  ...over,
});

export function runBackfillContract(name: string, make: () => Promise<BackfillHarness>): void {
  describe(name, () => {
    let h: BackfillHarness;
    beforeEach(async () => {
      h = await make();
      await h.reset();
    });

    it('tao khoang, doc lai thay o danh sach dang hieu luc va ghi audit', async () => {
      const w = await h.repo.createBackfillWindow(input(h.projectId), 'admin@x.vn');
      expect(typeof w).toBe('object');
      const created = w as BackfillWindow;
      expect(created).toMatchObject({ fromDate: '2026-01-01', toDate: '2026-06-30', enabledBy: 'admin@x.vn', disabledAt: null });
      const active = await h.repo.readActiveBackfillWindows(h.projectId, new Date());
      expect(active.map((a) => a.id)).toEqual([created.id]);
      expect(await h.auditCount(created.id)).toBe(1);
    });

    it('khoang trung khoang dang hieu luc -> overlap; khoang lien ke khong trung', async () => {
      await h.repo.createBackfillWindow(input(h.projectId), 'a@x.vn');
      expect(await h.repo.createBackfillWindow(input(h.projectId, { fromDate: '2026-06-30', toDate: '2026-08-01' }), 'a@x.vn')).toBe('overlap');
      const ok = await h.repo.createBackfillWindow(input(h.projectId, { fromDate: '2026-07-01', toDate: '2026-08-01' }), 'a@x.vn');
      expect(typeof ok).toBe('object');
    });

    it('du an khong ton tai -> not_found', async () => {
      expect(await h.repo.createBackfillWindow(input(2_000_000_000), 'a@x.vn')).toBe('not_found');
    });

    it('tat khoang: het hieu luc, con trong danh sach admin, tat lan 2 -> already, id la -> not_found', async () => {
      const w = (await h.repo.createBackfillWindow(input(h.projectId), 'a@x.vn')) as BackfillWindow;
      expect(await h.repo.disableBackfillWindow(w.id, 'b@x.vn')).toBe('ok');
      expect(await h.repo.readActiveBackfillWindows(h.projectId, new Date())).toEqual([]);
      const all = await h.repo.listBackfillWindows(h.projectId);
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ disabledBy: 'b@x.vn' });
      expect(all[0]!.disabledAt).not.toBeNull();
      expect(await h.repo.disableBackfillWindow(w.id, 'b@x.vn')).toBe('already');
      expect(await h.repo.disableBackfillWindow(2_000_000_000, 'b@x.vn')).toBe('not_found');
      expect(await h.auditCount(w.id)).toBe(2);
    });

    it('het han: khong con dang hieu luc, va khong chan khoang moi trung ngay', async () => {
      const past = new Date(Date.now() - 60_000);
      await h.repo.createBackfillWindow(input(h.projectId, { expiresAt: past }), 'a@x.vn');
      expect(await h.repo.readActiveBackfillWindows(h.projectId, new Date())).toEqual([]);
      const again = await h.repo.createBackfillWindow(input(h.projectId), 'a@x.vn');
      expect(typeof again).toBe('object');
    });

    it('khoang cua du an khac khong lot sang du an nay', async () => {
      await h.repo.createBackfillWindow(input(h.projectId), 'a@x.vn');
      expect(await h.repo.readActiveBackfillWindows(h.projectId + 999_999, new Date())).toEqual([]);
    });
  });
}
