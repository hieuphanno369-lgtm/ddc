import type { AuditLogEntry } from '@/server/repo/types';
import { formatDateTime } from '@/lib/format';

/** Bang rut gon audit_log dung o /admin - server-safe (khong 'use client', khong hook). */
export function AuditMiniTable({
  entries,
  locale,
  labels,
}: {
  entries: AuditLogEntry[];
  locale: string;
  labels: { time: string; user: string; table: string; record: string; field: string; empty: string };
}) {
  if (entries.length === 0) return <p className="empty">{labels.empty}</p>;

  return (
    <div className="scroll" style={{ maxHeight: 480, overflowY: 'auto' }}>
      <table className="tbl sticky">
        <thead>
          <tr>
            <th>{labels.time}</th>
            <th>{labels.user}</th>
            <th>{labels.table}</th>
            <th>{labels.record}</th>
            <th>{labels.field}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((a) => (
            <tr key={a.id}>
              <td className="mono">{formatDateTime(a.changedAt, locale)}</td>
              <td>{a.changedBy}</td>
              <td>{a.tableName}</td>
              <td className="mono">{a.recordId}</td>
              <td>{a.field}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
