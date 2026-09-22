import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { repo } from '@/server/repo';
import { AlertList } from '@/components/alerts/AlertList';

export default async function AlertsPage() {
  // RBAC server-side: trang vận hành dành cho admin + bod (không phó mặc middleware).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (!['admin', 'bod'].includes(user.role)) redirect(`/${locale}${homeForRole(user.role)}`);
  const t = await getTranslations();

  const projects = await repo.listProjects();
  const nameById = new Map(projects.map((p) => [p.id, p.projectName]));
  const open = (await repo.getAlerts())
    .filter((a) => !a.closedAt)
    .map((a) => ({ ...a, projectName: nameById.get(a.projectId) ?? '-' }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-navy-900">{t('alert.title')}</h1>
      <AlertList alerts={open} canClose={user.role === 'admin' || user.role === 'bod'} />
    </div>
  );
}
