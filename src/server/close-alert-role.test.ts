import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { repo } from '@/server/repo/mock-repo';
import type { CurrentUser } from '@/lib/session';

/**
 * Q1 (chốt 20/09/2026): BOD (Trưởng phòng) được đóng alert, không chỉ admin.
 * Admin + BOD đóng được MỌI alert; data-entry CHỈ alert thuộc dự án mình là PIC;
 * viewer bị từ chối. Test bám hành vi của closeAlertAction qua side-effect thật
 * (alert.closedAt + audit log ghi changedBy), không assert lên mock.
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/server/repo', async () => {
  const mockRepo = await import('@/server/repo/mock-repo');
  return { repo: mockRepo.repo };
});
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/session';
import { closeAlertAction } from '@/server/actions';

const ADMIN: CurrentUser = { name: 'Admin', email: 'admin@daidung.com.vn', role: 'admin', canViewFinance: true };
const BOD: CurrentUser = { name: 'BOD', email: 'bod@daidung.com.vn', role: 'bod', canViewFinance: true };
const VIEWER: CurrentUser = { name: 'Viewer', email: 'viewer@daidung.com.vn', role: 'viewer', canViewFinance: false };
/** pm@daidung.com.vn là PIC dự án 1,2,3,5,7,11; admin@daidung.com.vn giữ phần còn lại (seed buildAssignments). */
const PIC = 'pm@daidung.com.vn';
const dataEntry = (email: string): CurrentUser => ({ name: email, email, role: 'data-entry', canViewFinance: false });

function login(user: CurrentUser | null) {
  (getCurrentUser as Mock).mockResolvedValue(user);
}

function alertFor(ownsIt: boolean) {
  const mine = repo.getAssignmentsForUser(PIC);
  const open = repo.getAlerts().filter((a) => !a.closedAt);
  const found = open.find((a) => (ownsIt ? mine.includes(a.projectId) : !mine.includes(a.projectId)));
  if (!found) throw new Error(`seed không có alert ${ownsIt ? 'thuộc' : 'ngoài'} dự án của ${PIC}`);
  return found;
}

/** Mỗi dự án có đúng 1 PIC: chọn data-entry KHÁC PIC của alert để chắc chắn không có quyền. */
function picOf(projectId: number) {
  const a = repo.getAssignments().find((x) => x.projectId === projectId);
  if (!a) throw new Error(`dự án ${projectId} không có PIC trong seed`);
  return a.userEmail;
}

function nonPicOf(projectId: number) {
  const pic = picOf(projectId);
  return pic === 'pm@daidung.com.vn' ? 'admin@daidung.com.vn' : 'pm@daidung.com.vn';
}

const closedAt = (id: number) => repo.getAlerts().find((a) => a.id === id)?.closedAt ?? null;
const auditFor = (id: number) => repo.getAuditLog().filter((a) => a.tableName === 'alert_log' && a.recordId === String(id));

const UNKNOWN_ALERT_ID = 999_999;

describe('closeAlertAction - ma trận quyền (Q1: BOD đóng được alert)', () => {
  beforeEach(() => {
    repo.reset();
  });
  afterEach(() => {
    vi.clearAllMocks();
    repo.reset();
  });

  describe('đường chạy thuận lợi', () => {
    it('admin đóng được alert của dự án bất kỳ và alert chuyển sang đã đóng', async () => {
      const alert = alertFor(false);
      login(ADMIN);

      const res = await closeAlertAction(alert.id, 'Đã xử lý');

      expect(res).toEqual({ ok: true });
      expect(closedAt(alert.id)).not.toBeNull();
      expect(auditFor(alert.id).at(-1)?.changedBy).toBe(ADMIN.email);
    });

    it('BOD đóng được alert (hành vi MỚI của Q1) và alert chuyển sang đã đóng', async () => {
      const alert = alertFor(false);
      login(BOD);

      const res = await closeAlertAction(alert.id, 'Đã xử lý');

      expect(res).toEqual({ ok: true });
      expect(closedAt(alert.id)).not.toBeNull();
      expect(auditFor(alert.id).at(-1)?.changedBy).toBe(BOD.email);
    });

    it('data-entry là PIC của dự án đóng được alert của chính dự án đó', async () => {
      const alert = alertFor(true);
      login(dataEntry(PIC));

      const res = await closeAlertAction(alert.id, 'Đã xử lý');

      expect(res).toEqual({ ok: true });
      expect(closedAt(alert.id)).not.toBeNull();
    });
  });

  describe('trường hợp biên (kế hoạch mục "Chỗ Tester nên soi kỹ" #1)', () => {
    it('alertId không tồn tại: admin vẫn ok (giữ hành vi cũ), data-entry bị chặn', async () => {
      login(ADMIN);
      expect(await closeAlertAction(UNKNOWN_ALERT_ID, 'Đã xử lý')).toEqual({ ok: true });

      login(BOD);
      expect(await closeAlertAction(UNKNOWN_ALERT_ID, 'Đã xử lý')).toEqual({ ok: true });

      login(dataEntry(PIC));
      expect(await closeAlertAction(UNKNOWN_ALERT_ID, 'Đã xử lý')).toEqual({ ok: false, error: 'Forbidden' });
    });

    it('admin đóng liên tiếp 2 alert khác nhau đều thành công (không phụ thuộc dự án)', async () => {
      const [a, b] = repo.getAlerts().filter((x) => !x.closedAt);
      login(ADMIN);

      expect(await closeAlertAction(a.id, 'Đã xử lý')).toEqual({ ok: true });
      expect(await closeAlertAction(b.id, 'Đã xử lý')).toEqual({ ok: true });
      expect(closedAt(a.id)).not.toBeNull();
      expect(closedAt(b.id)).not.toBeNull();
    });
  });

  describe('trường hợp phải thất bại (từ chối + KHÔNG có side-effect)', () => {
    it('data-entry KHÔNG phải PIC của dự án thì bị Forbidden và alert giữ nguyên đang mở', async () => {
      const alert = alertFor(false);
      login(dataEntry(nonPicOf(alert.projectId)));

      const res = await closeAlertAction(alert.id, 'Đã xử lý');

      expect(res).toEqual({ ok: false, error: 'Forbidden' });
      expect(closedAt(alert.id)).toBeNull();
      expect(auditFor(alert.id)).toHaveLength(0);
    });

    it('viewer bị Forbidden và alert giữ nguyên đang mở', async () => {
      const alert = alertFor(true);
      login(VIEWER);

      const res = await closeAlertAction(alert.id, 'Đã xử lý');

      expect(res).toEqual({ ok: false, error: 'Forbidden' });
      expect(closedAt(alert.id)).toBeNull();
      expect(auditFor(alert.id)).toHaveLength(0);
    });

    it('chưa đăng nhập bị Forbidden', async () => {
      const alert = alertFor(true);
      login(null);

      expect(await closeAlertAction(alert.id, 'Đã xử lý')).toEqual({ ok: false, error: 'Forbidden' });
      expect(closedAt(alert.id)).toBeNull();
    });
  });

  describe('T11 (Task 8): hành động bắt buộc + không đóng 2 lần', () => {
    it("action 'ab' (< 3 ký tự) -> action_short, alert giữ nguyên đang mở", async () => {
      const alert = alertFor(false);
      login(ADMIN);

      const res = await closeAlertAction(alert.id, 'ab');

      expect(res).toEqual({ ok: false, error: 'action_short' });
      expect(closedAt(alert.id)).toBeNull();
    });

    it('đóng lần 2 -> already_closed', async () => {
      const alert = alertFor(false);
      login(ADMIN);

      expect(await closeAlertAction(alert.id, 'Đã xử lý')).toEqual({ ok: true });
      expect(await closeAlertAction(alert.id, 'Đã xử lý lần 2')).toEqual({ ok: false, error: 'already_closed' });
    });

    it('đóng kèm ghi chú -> closeNote va closedBy đúng email', async () => {
      const alert = alertFor(false);
      login(ADMIN);

      const res = await closeAlertAction(alert.id, 'Đã xử lý', 'Đã liên hệ nhà thầu');

      expect(res).toEqual({ ok: true });
      const saved = repo.getAlerts().find((a) => a.id === alert.id);
      expect(saved?.closeNote).toBe('Đã liên hệ nhà thầu');
      expect(saved?.closedBy).toBe(ADMIN.email);
    });
  });
});
