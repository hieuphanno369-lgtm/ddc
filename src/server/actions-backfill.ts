'use server';

import { logActivity } from '@/lib/activity';
import { BACKFILL_NOTE_MAX, BACKFILL_NOTE_MIN, backfillExpiresAt, checkBackfillRange } from '@/lib/backfill';
import { todayIso } from '@/lib/clock';
import { requireRoleUser } from './action-guards';
import { repo } from './repo';
import { z } from 'zod';

const projectIdSchema = z.number().int().positive();
const noteSchema = z.string().trim().min(BACKFILL_NOTE_MIN).max(BACKFILL_NOTE_MAX);

/**
 * P4 (F3, Q11): CHỈ admin bật nhập bù lịch sử cho 1 dự án. Kiểm quyền ở server (không tin client),
 * `projectId` số nguyên dương, khoảng theo Q12 (tối đa 24 tháng, kết thúc không sau hôm nay),
 * tự hết hiệu lực sau 30 ngày. Không cần duyệt (Q13), mọi lần bật ghi `audit_log` + `activity_log`.
 */
export async function enableBackfillAction(
  projectId: number,
  fromDate: string,
  toDate: string,
  note: string,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'too_long' | 'overlap' | 'Not found' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };

  const id = projectIdSchema.safeParse(projectId);
  const n = noteSchema.safeParse(note);
  if (!id.success || !n.success || typeof fromDate !== 'string' || typeof toDate !== 'string') return { ok: false, error: 'Invalid input' };
  const rangeError = checkBackfillRange(fromDate, toDate, todayIso());
  if (rangeError) return { ok: false, error: rangeError === 'too_long' ? 'too_long' : 'Invalid input' };

  const result = await repo.createBackfillWindow(
    { projectId: id.data, fromDate, toDate, note: n.data, expiresAt: backfillExpiresAt(new Date()) },
    user.email,
  );
  if (result === 'not_found') return { ok: false, error: 'Not found' };
  if (result === 'overlap') return { ok: false, error: 'overlap' };
  await logActivity(user, 'backfill_enable', `project ${id.data} · ${fromDate}..${toDate}`);
  return { ok: true };
}

/** P4 (F3, Q11): CHỈ admin tắt khoảng nhập bù (không xoá dòng, ghi `audit_log`). */
export async function disableBackfillAction(
  windowId: number,
): Promise<{ ok: true } | { ok: false; error: 'Forbidden' | 'Invalid input' | 'Not found' | 'already' }> {
  const user = await requireRoleUser(['admin']);
  if (!user) return { ok: false, error: 'Forbidden' };
  const id = projectIdSchema.safeParse(windowId);
  if (!id.success) return { ok: false, error: 'Invalid input' };

  const result = await repo.disableBackfillWindow(id.data, user.email);
  if (result === 'not_found') return { ok: false, error: 'Not found' };
  if (result === 'already') return { ok: false, error: 'already' };
  await logActivity(user, 'backfill_disable', `window ${id.data}`);
  return { ok: true };
}
