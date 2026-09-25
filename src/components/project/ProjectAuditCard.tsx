import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/format';
import type { AuditLogEntry } from '@/server/repo/types';

const VALUE_MAX = 160;

function truncate(s: string): { short: string; full: string } {
  if (s.length <= VALUE_MAX) return { short: s, full: s };
  return { short: `${s.slice(0, VALUE_MAX)}…`, full: s };
}

/**
 * Task 7 (P3A, G-16): thẻ "Dấu vết thay đổi" - append-only, nhận chuỗi đã dịch từ trang server
 * (component này không tự gọi useTranslations vì cần server-safe, dùng lại ở cả trang mới
 * và Chi tiết dự án).
 */
export function ProjectAuditCard(p: {
  entries: AuditLogEntry[];
  locale: string;
  labels: {
    title: string; chip: string; time: string; user: string; table: string; field: string;
    old: string; new: string; empty: string; note: string;
  };
  tableLabels: Record<string, string>;
}) {
  const { entries, locale, labels, tableLabels } = p;
  return (
    <Card className="overflow-visible">
      <CardHeader title={labels.title} titleExtra={<span className="chip c-plain">{labels.chip}</span>} />
      <CardBody>
        {entries.length === 0 ? (
          <p className="empty">{labels.empty}</p>
        ) : (
          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{labels.time}</th>
                  <th>{labels.user}</th>
                  <th>{labels.table}</th>
                  <th>{labels.field}</th>
                  <th>{labels.old}</th>
                  <th>{labels.new}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const oldV = truncate(e.oldValue);
                  const newV = truncate(e.newValue);
                  return (
                    <tr key={e.id}>
                      <td className="mono">{formatDateTime(e.changedAt, locale)}</td>
                      <td>{e.changedBy}</td>
                      <td>{tableLabels[e.tableName] ?? e.tableName}</td>
                      <td>{e.field}</td>
                      <td title={oldV.full}>{oldV.short}</td>
                      <td title={newV.full}>{newV.short}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="hintline">{labels.note}</p>
      </CardBody>
    </Card>
  );
}
