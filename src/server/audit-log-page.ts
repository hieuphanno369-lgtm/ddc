import { prisma } from '@/server/db';
import type { AuditLogEntry } from '@/server/repo/types';
import type { LogRange } from '@/lib/log-paging';
import { logSince } from '@/lib/log-paging';

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

/**
 * Doc audit_log truc tiep qua Prisma (khong qua repo/prisma-repo.ts - file nong khong duoc sua
 * trong P1B). count + findMany van quet bang vi chua co index (T1 thuoc P2B, chap nhan theo
 * yeu cau "khong them index" cua ke hoach).
 */
export async function getAuditLogPage(opts: {
  page: number;
  range: LogRange;
  pageSize?: number;
  now?: Date;
}): Promise<AuditLogPage> {
  const pageSize = opts.pageSize ?? 20;
  const since = logSince(opts.range, opts.now ?? new Date());
  const where = since ? { changedAt: { gte: since } } : {};

  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, opts.page), totalPages);

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items: rows.map((a) => ({
      id: a.id,
      tableName: a.tableName,
      recordId: a.recordId,
      field: a.field,
      oldValue: a.oldValue,
      newValue: a.newValue,
      changedBy: a.changedBy,
      changedAt: a.changedAt.toISOString(),
    })),
    total,
    page,
    totalPages,
    pageSize,
  };
}
