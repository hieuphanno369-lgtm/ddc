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
    <>
      <div className="flex justify-end">
        <ResetDataButton />
      </div>

      <Card className="overflow-visible">
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

      <Card className="overflow-visible">
        <CardHeader title={t('admin.activity')} subtitle={t('admin.retention')} />
        <CardBody>
          <ActivityViewer activity={activity} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Audit log" subtitle={String(audit.length)} />
        <CardBody>
          {audit.length === 0 ? (
            <p className="empty">{t('common.noData')}</p>
          ) : (
            <div className="scroll" style={{ maxHeight: 256 }}>
              <table className="tbl sticky">
                <thead>
                  <tr>
                    <th>{t('common.actions')}</th>
                    <th>Table</th>
                    <th>Record</th>
                    <th>Field</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{formatDate(a.changedAt, locale)}</td>
                      <td>{a.tableName}</td>
                      <td className="mono">{a.recordId}</td>
                      <td>{a.field}</td>
                      <td>{a.changedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-visible">
        <CardHeader
          title={t('admin.fieldEditor')}
          subtitle={t('admin.fieldEditorSub')}
        />
        <CardBody>
          <div className="flex flex-col gap-5">
            <div>
              <div className="sect"><b>{t('admin.customers')}</b><i /></div>
              <FieldEditor field="customer" values={customerValues} />
            </div>
            <div>
              <div className="sect"><b>{t('admin.teams')}</b><i /></div>
              <FieldEditor field="team" values={teamValues} />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="g2">
        <Card>
          <CardHeader title={t('admin.customers')} action={<IconUser size={18} />} />
          <CardBody>
            <DimTable
              head={[t('admin.name'), t('admin.code')]}
              rows={dims.customers.map((c) => [c.name, c.group])}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('admin.teams')} action={<IconUser size={18} />} />
          <CardBody>
            <DimTable
              head={[t('admin.name'), t('admin.picName')]}
              rows={dims.teams.map((x) => [x.name, x.picName])}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('admin.factories')} action={<IconFactory size={18} />} />
          <CardBody>
            <DimTable
              head={[t('admin.name'), t('admin.region'), t('admin.capacity')]}
              rows={dims.factories.map((f) => [f.name, f.region, formatTon(f.capacityTonPerYear, locale)])}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('admin.currencies')} action={<IconMoney size={18} />} />
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
    </>
  );
}

function DimTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="scroll" style={{ maxHeight: 256 }}>
      <table className="tbl sticky">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className={j === 0 ? '' : undefined} style={j === 0 ? { fontWeight: 600 } : undefined}>
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
