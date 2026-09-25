import { repo } from '@/server/repo';
import type { AuditLogPageResult } from '@/server/repo/read-types';
import type { LogRange } from '@/lib/log-paging';
import { logSince } from '@/lib/log-paging';

export type AuditLogPage = AuditLogPageResult;

/**
 * Doc audit_log qua read repo (`readAuditLogPage`) - index `audit_log_changedAt_idx` ĐÃ CÓ từ
 * migration P1A nên count/findMany filter theo `changedAt` dùng index, không quét cả bảng.
 */
export async function getAuditLogPage(opts: {
  page: number;
  range: LogRange;
  pageSize?: number;
  now?: Date;
}): Promise<AuditLogPage> {
  return repo.readAuditLogPage({
    since: logSince(opts.range, opts.now ?? new Date()),
    page: opts.page,
    pageSize: opts.pageSize ?? 20,
  });
}
