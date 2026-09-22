import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { repo } from '@/server/repo';
import { formatDate, formatTon } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { IconFactory, IconMoney, IconUser } from '@/components/icons';
import { ResetDataButton } from '@/components/admin/ResetDataButton';
import { UserEditor } from '@/components/admin/UserEditor';
import { ActivityViewer } from '@/components/admin/ActivityViewer';
import { FieldEditor } from '@/components/admin/FieldEditor';
import { DeleteProject } from '@/components/admin/DeleteProject';

export default async function AdminPage() {
  // RBAC server-side: trang admin chỉ dành cho admin (không phó mặc middleware).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}${homeForRole(user.role)}`);
  const t = await getTranslations();
  const dims = await repo.getDims();
  const projects = (await repo.listProjects()).map((p) => ({ id: p.id, name: p.projectName, code: p.currentAliasCode }));
  const audit = await repo.getAuditLog();
  const users = await repo.getUserRoles();
  const activity = await repo.getActivity();
  const customerValues = await repo.getDimFieldValues('customer');
  const teamValues = await repo.getDimFieldValues('team');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-navy-900">{t('admin.title')}</h1>
        <ResetDataButton />
      </div>

      <Card>
        <CardHeader title={t('admin.userRoles')} />
        <CardBody>
          <UserEditor users={users} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('admin.deleteProject')} />
        <CardBody>
          <DeleteProject projects={projects} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('admin.activity')} subtitle={t('admin.retention')} />
        <CardBody>
          <ActivityViewer activity={activity} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Audit log" subtitle={String(audit.length)} />
        <CardBody>
          {audit.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">{t('common.noData')}</p>
          ) : (
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-400">
                    <th className="py-1.5 font-medium">{t('common.actions')}</th>
                    <th className="py-1.5 font-medium">Table</th>
                    <th className="py-1.5 font-medium">Record</th>
                    <th className="py-1.5 font-medium">Field</th>
                    <th className="py-1.5 font-medium">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="py-1.5 font-mono text-xs text-slate-500">{formatDate(a.changedAt, locale)}</td>
                      <td className="py-1.5 text-xs text-navy-800">{a.tableName}</td>
                      <td className="py-1.5 font-mono text-xs text-slate-500">{a.recordId}</td>
                      <td className="py-1.5 text-xs text-slate-500">{a.field}</td>
                      <td className="py-1.5 text-xs text-slate-500">{a.changedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t('admin.fieldEditor')}
          subtitle={t('admin.fieldEditorSub')}
        />
        <CardBody>
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-medium text-navy-900">{t('admin.customers')}</h3>
              <FieldEditor field="customer" values={customerValues} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-navy-900">{t('admin.teams')}</h3>
              <FieldEditor field="team" values={teamValues} />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('admin.customers')} action={<IconUser size={18} className="text-navy-400" />} />
          <CardBody>
            <DimTable
              head={[t('admin.name'), t('admin.code')]}
              rows={dims.customers.map((c) => [c.name, c.group])}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('admin.teams')} action={<IconUser size={18} className="text-navy-400" />} />
          <CardBody>
            <DimTable
              head={[t('admin.name'), t('admin.picName')]}
              rows={dims.teams.map((x) => [x.name, x.picName])}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('admin.factories')} action={<IconFactory size={18} className="text-navy-400" />} />
          <CardBody>
            <DimTable
              head={[t('admin.name'), t('admin.region'), t('admin.capacity')]}
              rows={dims.factories.map((f) => [f.name, f.region, formatTon(f.capacityTonPerYear, locale)])}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('admin.currencies')} action={<IconMoney size={18} className="text-navy-400" />} />
          <CardBody>
            <DimTable
              head={[t('admin.code'), t('admin.name'), t('admin.rate')]}
              rows={dims.currencies.map((c) => {
                const rate = dims.exchangeRates.find((r) => r.currencyCode === c.code);
                return [c.code, c.name, rate ? formatTon(rate.rateToVnd, locale) : '-'];
              })}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function DimTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="max-h-64 overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-400">
            {head.map((h) => (
              <th key={h} className="py-1.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className={`py-2 ${j === 0 ? 'font-medium text-navy-900' : 'text-slate-600'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
