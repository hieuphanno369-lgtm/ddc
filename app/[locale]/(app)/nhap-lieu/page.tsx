import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { repo } from '@/server/repo';
import { currentMonth, historyMonths, todayIso } from '@/lib/clock';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { DataEntryForm, type DataEntryStep } from '@/components/form/DataEntryForm';
import { CreateProjectForm } from '@/components/form/CreateProjectForm';

const STEPS: DataEntryStep[] = ['progress', 'finance', 'profile', 'extras'];

export default async function NhapLieuPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // F2a (danh-gia.md, vong sua 1): trang tu kiem quyen server-side, khong pho mac middleware
  // (CVE-2025-29927 co the bi bypass qua header x-middleware-subrequest).
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin' && user.role !== 'data-entry') redirect(`/${locale}${homeForRole(user.role)}`);
  const t = await getTranslations();

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

  const months = historyMonths();
  const month =
    typeof searchParams.month === 'string' && months.includes(searchParams.month)
      ? searchParams.month
      : currentMonth();

  const dims = await repo.getDims();
  const project = (await repo.getProject(selectedId)) ?? (await repo.getProject(projects[0]?.id));

  const fact = project ? await repo.getLatestFact(project.id, month) : undefined;
  // F2a (danh-gia.md, vong sua 1): fail-closed - chi lay va truyen so tai chinh khi user co quyen xem.
  const financial =
    project && user.canViewFinance ? (await repo.getFinancial(project.id)).find((f) => f.yearMonth === month) : undefined;
  const chain = project ? await repo.getValueChain(project.id, month) : [];
  const alerts = project ? await repo.getAlerts(project.id) : [];
  const aliases = project ? await repo.getAliases(project.id) : [];
  const sapCodes = project ? await repo.getSapCodes(project.id) : [];
  const photos = project ? await repo.getPhotos(project.id) : [];
  const locked = await repo.isMonthLocked(month);
  const keyMilestones = project ? await repo.getKeyMilestones(project.id) : [];
  const today = todayIso();
  const initialStep = typeof searchParams.step === 'string' && (STEPS as string[]).includes(searchParams.step)
    ? (searchParams.step as DataEntryStep) : undefined;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <section className="mb-5">
        <div className="sect"><b>{t('form.sectionNew')}</b><i /></div>
        <CreateProjectForm customers={dims.customers} teams={dims.teams} currencies={dims.currencies} today={today} />
      </section>

      <section>
        <div className="sect"><b>{t('form.sectionUpdate')}</b><i /></div>
        {!project || projects.length === 0 ? (
          <p className="empty">{t('common.noData')}</p>
        ) : (
          // bod không còn tới trang này (redirect ở đầu file) - chỉ admin/data-entry còn lại.
          <DataEntryForm
            key={`${project.id}-${month}`}
            projectId={project.id}
            projects={projects}
            project={project}
            fact={fact}
            financial={user.canViewFinance ? financial : undefined}
            chain={chain}
            alerts={alerts}
            aliases={aliases}
            sapCodes={sapCodes}
            photos={photos}
            month={month}
            months={months}
            locked={locked}
            canLock={user.role === 'admin'}
            customers={dims.customers}
            teams={dims.teams}
            currencies={dims.currencies}
            keyMilestones={keyMilestones}
            today={today}
            initialStep={initialStep}
            canEditFinance={user.role === 'admin'}
          />
        )}
      </section>
    </div>
  );
}
