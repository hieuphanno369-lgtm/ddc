import { getTranslations } from 'next-intl/server';
import { repo } from '@/server/repo';
import { currentMonth } from '@/server/queries';
import { HISTORY_MONTHS } from '@/data/seed/history';
import { getCurrentUser } from '@/lib/session';
import { DataEntryForm } from '@/components/form/DataEntryForm';
import { CreateProjectForm } from '@/components/form/CreateProjectForm';

export default async function NhapLieuPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations();
  const user = await getCurrentUser();

  // RBAC: data-entry chỉ thấy dự án mình là PIC (project_assignments). Admin thấy hết.
  let all = await repo.listProjects();
  if (user?.role === 'data-entry') {
    const assigned = new Set(await repo.getAssignmentsForUser(user.email));
    all = all.filter((p) => assigned.has(p.id));
  }
  const projects = all.map((p) => ({ id: p.id, name: p.projectName, code: p.currentAliasCode }));

  const selectedRaw = typeof searchParams.project === 'string' ? Number(searchParams.project) : NaN;
  const selectedId =
    Number.isFinite(selectedRaw) && all.some((p) => p.id === selectedRaw) ? selectedRaw : all[0]?.id;

  const month =
    typeof searchParams.month === 'string' && HISTORY_MONTHS.includes(searchParams.month)
      ? searchParams.month
      : currentMonth;

  const dims = await repo.getDims();
  const project = (await repo.getProject(selectedId)) ?? (await repo.getProject(projects[0]?.id));

  const fact = project ? await repo.getLatestFact(project.id, month) : undefined;
  const financial = project ? (await repo.getFinancial(project.id)).find((f) => f.yearMonth === month) : undefined;
  const chain = project ? await repo.getValueChain(project.id, month) : [];
  const alerts = project ? await repo.getAlerts(project.id) : [];
  const aliases = project ? await repo.getAliases(project.id) : [];
  const sapCodes = project ? await repo.getSapCodes(project.id) : [];
  const photos = project ? await repo.getPhotos(project.id) : [];
  const locked = await repo.isMonthLocked(month);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-lg font-semibold text-navy-900">{t('form.title')}</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-navy-800">{t('form.sectionNew')}</h2>
        <CreateProjectForm customers={dims.customers} teams={dims.teams} currencies={dims.currencies} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-navy-800">{t('form.sectionUpdate')}</h2>
        {!project || projects.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">{t('common.noData')}</p>
        ) : (
          <DataEntryForm
            key={`${project.id}-${month}`}
            projectId={project.id}
            projects={projects}
            project={project}
            fact={fact}
            financial={financial}
            chain={chain}
            alerts={alerts}
            aliases={aliases}
            sapCodes={sapCodes}
            photos={photos}
            month={month}
            months={HISTORY_MONTHS}
            locked={locked}
            canLock={user?.role === 'admin'}
            customers={dims.customers}
            teams={dims.teams}
            currencies={dims.currencies}
          />
        )}
      </section>
    </div>
  );
}
