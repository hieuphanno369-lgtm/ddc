import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { repo } from '@/server/repo';
import { formatDateTime } from '@/lib/format';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default async function AuditPage() {
  // RBAC server-side: nhật ký thay đổi chỉ dành cho admin (không phó mặc middleware).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}${homeForRole(user.role)}`);
  const t = await getTranslations();

  const audit = await repo.getAuditLog();

  return (
    <>
      <Card>
        <div className="hd">
          <h3>{t('audit.title')}</h3>
          <Badge tone="neutral">{audit.length}</Badge>
        </div>
        <CardBody className="scroll">
          {audit.length === 0 ? (
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
                {audit.map((a) => (
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
      </Card>
    </>
  );
}
