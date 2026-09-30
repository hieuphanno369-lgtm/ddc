import { prisma } from '@/server/db';
import { audit } from './prisma-repo-entry';
import type { BackfillWindow, CreateBackfillWindowInput } from './types';

type Row = Awaited<ReturnType<typeof prisma.projectBackfillWindow.findFirstOrThrow>>;

const day = (d: Date): string => d.toISOString().slice(0, 10);
const dateOnly = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

function toWindow(r: Row): BackfillWindow {
  return {
    id: r.id,
    projectId: r.projectId,
    fromDate: day(r.fromDate),
    toDate: day(r.toDate),
    note: r.note,
    enabledBy: r.enabledBy,
    enabledAt: r.enabledAt.toISOString(),
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    disabledBy: r.disabledBy,
    disabledAt: r.disabledAt ? r.disabledAt.toISOString() : null,
  };
}

/** Điều kiện "đang hiệu lực": chưa tắt và chưa hết hạn tại `now`. */
const activeWhere = (now: Date) => ({
  disabledAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

/**
 * P4 (F2): repo nhập bù lịch sử - file riêng, gộp vào `repo` qua `Object.assign` ở index.ts
 * (khuôn `prisma-repo-notify.ts`), không sửa prisma-repo.ts.
 */
export const backfillRepoPrisma = {
  /** Khoảng đang hiệu lực của 1 dự án (chưa tắt, chưa hết hạn tại `now`), cũ nhất trước. */
  async readActiveBackfillWindows(projectId: number, now: Date): Promise<BackfillWindow[]> {
    const rows = await prisma.projectBackfillWindow.findMany({
      where: { projectId, ...activeWhere(now) },
      orderBy: { fromDate: 'asc' },
    });
    return rows.map(toWindow);
  },

  /** Mọi khoảng của dự án (kể cả đã tắt/hết hạn), mới nhất trước - cho admin. */
  async listBackfillWindows(projectId: number): Promise<BackfillWindow[]> {
    const rows = await prisma.projectBackfillWindow.findMany({ where: { projectId }, orderBy: { id: 'desc' } });
    return rows.map(toWindow);
  },

  /** Tạo khoảng mới; trùng khoảng đang hiệu lực → 'overlap'. Kiểm trùng + ghi + audit trong 1 transaction. */
  async createBackfillWindow(input: CreateBackfillWindowInput, by: string): Promise<BackfillWindow | 'overlap' | 'not_found'> {
    return prisma.$transaction(async (tx) => {
      // Khoá dòng dự án tới hết transaction: 2 admin bật cùng lúc phải xếp hàng, nếu không cả hai cùng qua kiểm trùng (READ COMMITTED).
      const locked = await tx.$queryRaw<{ id: number }[]>`SELECT "id" FROM "dim_project" WHERE "id" = ${input.projectId} FOR UPDATE`;
      if (locked.length === 0) return 'not_found' as const;
      const from = dateOnly(input.fromDate);
      const to = dateOnly(input.toDate);
      const clash = await tx.projectBackfillWindow.findFirst({
        where: { projectId: input.projectId, ...activeWhere(new Date()), fromDate: { lte: to }, toDate: { gte: from } },
        select: { id: true },
      });
      if (clash) return 'overlap' as const;
      const row = await tx.projectBackfillWindow.create({
        data: { projectId: input.projectId, fromDate: from, toDate: to, note: input.note, enabledBy: by, expiresAt: input.expiresAt },
      });
      await audit(tx, 'project_backfill_window', String(row.id), 'enable', '', `${input.fromDate}..${input.toDate}`, by, input.note);
      return toWindow(row);
    });
  },

  /** Tắt khoảng (không xoá dòng). Đã tắt rồi → 'already'. Điều kiện `disabledAt: null` ở updateMany chặn race. */
  async disableBackfillWindow(id: number, by: string): Promise<'ok' | 'not_found' | 'already'> {
    return prisma.$transaction(async (tx) => {
      const row = await tx.projectBackfillWindow.findUnique({ where: { id } });
      if (!row) return 'not_found' as const;
      const res = await tx.projectBackfillWindow.updateMany({ where: { id, disabledAt: null }, data: { disabledAt: new Date(), disabledBy: by } });
      if (res.count === 0) return 'already' as const;
      await audit(tx, 'project_backfill_window', String(id), 'disable', `${day(row.fromDate)}..${day(row.toDate)}`, '', by);
      return 'ok' as const;
    });
  },
};
