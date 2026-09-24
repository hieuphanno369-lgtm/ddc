import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { repo } from '@/server/repo';
import { formatTon } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { IconFactory, IconMoney, IconUser } from '@/components/icons';
import { ResetDataButton } from '@/components/admin/ResetDataButton';
import { UserEditor } from '@/components/admin/UserEditor';
import { ActivityViewer } from '@/components/admin/ActivityViewer';
import { FieldEditor } from '@/components/admin/FieldEditor';
import { DeleteProject } from '@/components/admin/DeleteProject';
import { AuditMiniTable } from '@/components/admin/AuditMiniTable';
import { FactoryEditor } from '@/components/admin/FactoryEditor';
import { logSince } from '@/lib/log-paging';
import { getAuditLogPage } from '@/server/audit-log-page';

export default async function AdminPage() {
  // RBAC server-side: trang admin chỉ dành cho admin (không phó mặc middleware).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(`/${locale}${homeForRole(user.role)}`);
  const t = await getTranslations();
  const dims = await repo.getDims();
  const projects = (await repo.listProjects()).map((p) => ({ id: p.id, name: p.projectName, code: p.currentAliasCode }));
  const auditPage = await getAuditLogPage({ page: 1, range: '14d' });
  const users = await repo.getUserRoles();
  // Xoa luoi chi chay khi co ghi moi -> phai loc luc doc (giu retention 14 ngay).
  const since = logSince('14d', new Date())!;
  const activity = (await repo.getActivity()).filter((a) => new Date(a.createdAt) >= since);
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
        <CardHeader title={t('audit.title')} subtitle={`${t('logPaging.range14')} · ${auditPage.total}`} />
        <CardBody>
          <AuditMiniTable
            entries={auditPage.items}
            locale={locale}
            labels={{
              time: t('admin.time'),
              user: t('admin.user'),
              table: t('audit.table'),
              record: t('audit.record'),
              field: t('audit.field'),
              empty: t('common.noData'),
            }}
          />
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

      <Card className="overflow-visible">
        <CardHeader title={t('factoryAdmin.title')} action={<IconFactory size={18} />} />
        <CardBody>
          <FactoryEditor factories={dims.factories} />
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
