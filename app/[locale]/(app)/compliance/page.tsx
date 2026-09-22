import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { repo } from '@/server/repo';
import { currentMonth } from '@/lib/clock';
import { deriveStatus } from '@/lib/evm';
import { Link } from '@/i18n/navigation';
import { formatDateTime } from '@/lib/format';
import { Card, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badges';

export default async function CompliancePage() {
  // RBAC server-side: trang vận hành dành cho admin + bod (không phó mặc middleware).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (!['admin', 'bod'].includes(user.role)) redirect(`/${locale}${homeForRole(user.role)}`);
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
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-navy-900">{t('compliance.title')}</h1>

      <Card>
        <CardBody className="pt-4">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">{t('compliance.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm table-zebra">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-medium">{t('common.project')}</th>
                    <th className="px-4 py-2.5 font-medium">Mã DA</th>
                    <th className="px-4 py-2.5 font-medium">{t('compliance.pm')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('common.status')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('compliance.lastUpdate')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/projects/${r.id}`} className="font-medium text-navy-900 hover:text-accent">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.code}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.pm}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{formatDateTime(r.lastUpdate, locale)}</td>
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
