import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { repo } from '@/server/repo';
import { formatDateTime } from '@/lib/format';
import { Card, CardBody } from '@/components/ui/Card';

export default async function AuditPage() {
  // RBAC server-side: nhật ký thay đổi chỉ dành cho admin (không phó mặc middleware).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}${homeForRole(user.role)}`);
  const t = await getTranslations();

  const audit = await repo.getAuditLog();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-navy-900">{t('audit.title')}</h1>

      <Card>
        <CardBody className="pt-4">
          {audit.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">{t('common.noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm table-zebra">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-medium">{t('admin.time')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('admin.user')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('audit.table')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('audit.record')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('audit.field')}</th>
                    <th className="px-4 py-2.5 font-medium">
                      {t('audit.old')} → {t('audit.new')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{formatDateTime(a.changedAt, locale)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{a.changedBy}</td>
                      <td className="px-4 py-2.5 text-xs text-navy-800">{a.tableName}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{a.recordId}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{a.field}</td>
                      <td className="max-w-[300px] break-all px-4 py-2.5">
                        <span className="font-mono text-xs text-slate-500">{a.oldValue || '-'}</span>
                        <span className="mx-1 text-slate-300">→</span>
                        <span className="font-mono text-xs text-navy-800">{a.newValue || '-'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
