import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/require-user';
import { repo } from '@/server/repo';
import { getSignupStore } from '@/server/signup-store';
import { historyMonths } from '@/lib/clock';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { IconAlert, IconChecklist, IconFactory, IconMoney, IconUser } from '@/components/icons';
import { UserEditor } from '@/components/admin/UserEditor';
import { toAdminUserRow } from '@/lib/admin-user-row';
import { ActivityViewer } from '@/components/admin/ActivityViewer';
import { FieldEditor } from '@/components/admin/FieldEditor';
import { DeleteProject } from '@/components/admin/DeleteProject';
import { AuditMiniTable } from '@/components/admin/AuditMiniTable';
import { FactoryEditor } from '@/components/admin/FactoryEditor';
import { StageEditor } from '@/components/admin/StageEditor';
import { SignupRequestList } from '@/components/admin/SignupRequestList';
import { DepartmentEditor } from '@/components/admin/DepartmentEditor';
import { ExchangeRateEditor } from '@/components/admin/ExchangeRateEditor';
import { NotifyChannelEditor } from '@/components/admin/NotifyChannelEditor';
import { hasSecretKey } from '@/lib/secret-box';
import { logSince } from '@/lib/log-paging';
import { getAuditLogPage } from '@/server/audit-log-page';

export default async function AdminPage() {
  // RBAC server-side: trang admin chỉ dành cho admin (không phó mặc middleware).
  const locale = await getLocale();
  await requireUser(locale, ['admin']);
  const t = await getTranslations();
  const dims = await repo.getDims();
  const projects = (await repo.listProjects()).map((p) => ({ id: p.id, name: p.projectName, code: p.currentAliasCode }));
  const auditPage = await getAuditLogPage({ page: 1, range: '14d' });
  const users = await repo.getUserRoles();
  // Loc theo since NGAY TRONG TRUY VAN (readActivitySince) thay vi doc het roi loc trong bo nho
  // (giu retention 14 ngay, T1: tranh quet ca bang activity_log).
  const activity = await repo.readActivitySince(logSince('14d', new Date())!);
  const customerValues = await repo.getDimFieldValues('customer');
  const teamValues = await repo.getDimFieldValues('team');
  // P7-C2: mọi giai đoạn (cả ngừng dùng) để admin dùng lại được.
  const stages = await repo.getStages();
  // P3F-3: đọc thẳng từ kho mỗi lần render (không cache tag); client gọi router.refresh() sau thao tác.
  const signup = getSignupStore();
  const pending = await signup.listPending();
  const departments = await signup.listDepartments();

  return (
    <>
      <div id="dang-ky-cho">
        <Card className="overflow-visible">
          <CardHeader title={t('signup.pendingTitle', { n: pending.length })} action={<IconUser size={18} />} />
          <CardBody>
            <SignupRequestList requests={pending} />
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-visible">
        <CardHeader title={t('admin.userRoles')} />
        <CardBody>
          <UserEditor users={users.map(toAdminUserRow)} />
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

      <Card className="overflow-visible">
        <CardHeader title={t('department.title')} action={<IconUser size={18} />} />
        <CardBody>
          <DepartmentEditor departments={departments} />
        </CardBody>
      </Card>

      <Card className="overflow-visible">
        <CardHeader title={t('stageAdmin.title')} action={<IconChecklist size={18} />} />
        <CardBody>
          <StageEditor stages={stages} />
        </CardBody>
      </Card>

      <Card className="overflow-visible">
        <CardHeader title={t('fxRates.title')} action={<IconMoney size={18} />} />
        <CardBody>
          <ExchangeRateEditor
            months={[...historyMonths(12)].reverse()}
            rates={await repo.getExchangeRates()}
          />
        </CardBody>
      </Card>

      <Card className="overflow-visible">
        <CardHeader title={t('notifyAdmin.title')} action={<IconAlert size={18} />} />
        <CardBody>
          <NotifyChannelEditor channels={await repo.listNotifyChannels()} recipients={await repo.getNotifyRecipients()} secretKeyReady={hasSecretKey()} />
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
