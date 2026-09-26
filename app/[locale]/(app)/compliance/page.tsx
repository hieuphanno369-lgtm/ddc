import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/require-user';
import { repo } from '@/server/repo';
import { currentMonth } from '@/lib/clock';
import { deriveStatus } from '@/lib/evm';
import { Link } from '@/i18n/navigation';
import { formatDateTime } from '@/lib/format';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/Badges';

export default async function CompliancePage() {
  // RBAC server-side: trang vận hành dành cho admin + bod (không phó mặc middleware).
  const locale = await getLocale();
  await requireUser(locale, ['admin', 'bod']);
  const t = await getTranslations();

  const projects = await repo.listProjects();
  const assignments = await repo.getAssignments();
  const users = await repo.getUserRoles();
  const month = currentMonth();
  const rows = (
    await Promise.all(
      projects.map(async (p) => {
        const fact = await repo.getLatestFact(p.id, month);
        const status = deriveStatus({
          actualStartDate: p.actualStartDate,
          actualFinishDate: p.actualFinishDate,
          pctActual: fact?.pctActual ?? 0,
        });
        if (status !== 'Dang_trien_khai' || fact) return null; // bỏ qua đã nộp + không đang triển khai
        const pic = assignments.find((a) => a.projectId === p.id && a.roleInProject === 'PIC');
        const latest = await repo.getLatestFact(p.id, 'all');
        return {
          id: p.id,
          name: p.projectName,
          code: p.currentAliasCode,
          pm: pic ? (users.find((u) => u.email === pic.userEmail)?.name ?? pic.userEmail) : '-',
          status,
          lastUpdate: latest?.changedAt ?? null,
        };
      }),
    )
  ).filter((x): x is NonNullable<typeof x> => x != null);

  return (
    <>
      <Card>
        <div className="hd">
          <h3>{t('compliance.title')}</h3>
          <Badge tone="warn">{rows.length}</Badge>
        </div>
        <CardBody className="scroll">
          {rows.length === 0 ? (
            <p className="empty">{t('compliance.empty')}</p>
          ) : (
            <table className="tbl" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>{t('common.project')}</th>
                  <th>Mã DA</th>
                  <th>{t('compliance.pm')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('compliance.lastUpdate')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>
                      <Link href={`/projects/${r.id}`}>
                        {r.name}
                      </Link>
                    </td>
                    <td className="mono">{r.code}</td>
                    <td>{r.pm}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>{formatDateTime(r.lastUpdate, locale)}</td>
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
