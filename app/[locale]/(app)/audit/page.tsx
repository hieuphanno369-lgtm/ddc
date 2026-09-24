import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { formatDateTime } from '@/lib/format';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Link } from '@/i18n/navigation';
import { auditHref, parseLogRange, parsePage } from '@/lib/log-paging';
import { getAuditLogPage } from '@/server/audit-log-page';

export default async function AuditPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // RBAC server-side: nhật ký thay đổi chỉ dành cho admin (không phó mặc middleware).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}${homeForRole(user.role)}`);
  const t = await getTranslations();

  const range = parseLogRange(searchParams.range);
  const data = await getAuditLogPage({ page: parsePage(searchParams.page), range });

  const pillStyle = { padding: '5px 12px', fontSize: 'var(--t-caption1)' };

  return (
    <>
      <Card>
        <div className="hd">
          <h3>{t('audit.title')}</h3>
          <Badge tone="neutral">{data.total}</Badge>
        </div>
        <div className="flex items-center gap-2 px-4 pb-3">
          <Link href={auditHref({ page: 1, range: '14d' })} className={range === '14d' ? 'btn' : 'btn ghost'} style={pillStyle}>
            {t('logPaging.range14')}
          </Link>
          <Link href={auditHref({ page: 1, range: 'all' })} className={range === 'all' ? 'btn' : 'btn ghost'} style={pillStyle}>
            {t('logPaging.rangeAll')}
          </Link>
        </div>
        <CardBody className="scroll" style={{ maxHeight: 600, overflowY: 'auto' }}>
          {data.items.length === 0 ? (
            <p className="empty">{t('common.noData')}</p>
          ) : (
            <table className="tbl sticky" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>{t('admin.time')}</th>
                  <th>{t('admin.user')}</th>
                  <th>{t('audit.table')}</th>
                  <th>{t('audit.record')}</th>
                  <th>{t('audit.field')}</th>
                  <th>
                    {t('audit.old')} → {t('audit.new')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{formatDateTime(a.changedAt, locale)}</td>
                    <td>{a.changedBy}</td>
                    <td>
                      <Badge tone="neutral">{a.tableName}</Badge>
                    </td>
                    <td className="mono">{a.recordId}</td>
                    <td>{a.field}</td>
                    <td style={{ maxWidth: 300, whiteSpace: 'normal', wordBreak: 'break-all' }}>
                      <span className="mono">{a.oldValue || '-'}</span>
                      <span className="mx-1 text-label3">→</span>
                      <span className="mono">{a.newValue || '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>

        {data.items.length > 0 && (
          <div className="flex items-center justify-end gap-2 border-t border-sep px-4 py-3 text-caption1 text-label2">
            {data.page <= 1 ? (
              <span className="btn ghost" aria-disabled="true" style={{ ...pillStyle, opacity: 0.4 }}>←</span>
            ) : (
              <Link href={auditHref({ page: data.page - 1, range })} aria-label={t('logPaging.prev')} className="btn ghost" style={pillStyle}>←</Link>
            )}
            <span className="text-xs">{`${data.page} / ${data.totalPages}`}</span>
            {data.page >= data.totalPages ? (
              <span className="btn ghost" aria-disabled="true" style={{ ...pillStyle, opacity: 0.4 }}>→</span>
            ) : (
              <Link href={auditHref({ page: data.page + 1, range })} aria-label={t('logPaging.next')} className="btn ghost" style={pillStyle}>→</Link>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
