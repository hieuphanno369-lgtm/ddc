import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { repo } from '@/server/repo';
import { todayIso } from '@/lib/clock';
import { requireUser } from '@/lib/require-user';
import { ProjectForm } from '@/components/form/ProjectForm';
import { ProjectAuditCard } from '@/components/project/ProjectAuditCard';

export default async function HoSoDuAnPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const locale = await getLocale();
  const user = await requireUser(locale, ['admin', 'data-entry']);
  const t = await getTranslations();

  // RBAC: data-entry chỉ thấy dự án mình được gán (PIC/Backup); admin thấy hết.
  let all = await repo.listProjects();
  if (user.role === 'data-entry') {
    const assigned = new Set(await repo.getAssignmentsForUser(user.email));
    all = all.filter((p) => assigned.has(p.id));
  }
  const writable = all.map((p) => ({ id: p.id, name: p.projectName, code: p.currentAliasCode }));

  const projectParam = typeof searchParams.project === 'string' ? Number(searchParams.project) : NaN;
  const requestedEdit = Number.isFinite(projectParam);
  if (requestedEdit && !writable.some((p) => p.id === projectParam)) notFound();
  const mode: 'new' | 'edit' = requestedEdit ? 'edit' : 'new';
  const selectedId = requestedEdit ? projectParam : undefined;

  const [dims, exchangeRates, today] = await Promise.all([repo.getDims(), repo.getExchangeRates(), Promise.resolve(todayIso())]);

  const project = selectedId != null ? (await repo.getProject(selectedId)) ?? null : null;

  const [sapCodes, stageWeights, keyMilestones, members, contractorMembers, allContractors, auditTrail] = project
    ? await Promise.all([
        repo.getSapCodes(project.id),
        repo.getStageWeights(project.id),
        repo.getKeyMilestones(project.id),
        repo.getProjectMembers(project.id),
        repo.getContractors(project.id),
        repo.getContractors(),
        repo.readProjectAuditTrail(project.id, 50),
      ])
    : [[], [], [], [], [], await repo.getContractors(), []];

  const assignableUsers = user.role === 'admin'
    ? (await repo.getUserRoles())
        .filter((u) => u.isActive && (u.role === 'data-entry' || u.role === 'viewer'))
        .map((u) => ({ email: u.email, name: u.name, role: u.role }))
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <ProjectForm
        key={project?.id ?? 'new'}
        mode={mode}
        project={project}
        projects={writable}
        customers={dims.customers}
        teams={dims.teams}
        currencies={dims.currencies}
        factories={dims.factories}
        exchangeRates={exchangeRates}
        sapCodes={sapCodes}
        stageWeights={stageWeights}
        keyMilestones={keyMilestones}
        members={members}
        assignableUsers={assignableUsers}
        contractorMembers={contractorMembers}
        allContractors={allContractors}
        ownerEmail={user.email}
        today={today}
      />
      {mode === 'edit' && project && (
        <ProjectAuditCard
          entries={auditTrail}
          locale={locale}
          labels={{
            title: t('projectForm.audit.title'),
            chip: t('projectForm.audit.chip'),
            time: t('projectForm.audit.time'),
            user: t('projectForm.audit.user'),
            table: t('projectForm.audit.table'),
            field: t('projectForm.audit.field'),
            old: t('projectForm.audit.old'),
            new: t('projectForm.audit.new'),
            empty: t('projectForm.audit.empty'),
            note: t('projectForm.audit.note'),
          }}
          tableLabels={{
            dim_project: t('projectForm.audit.tbl.dim_project'),
            dim_project_alias: t('projectForm.audit.tbl.dim_project_alias'),
            project_key_milestone: t('projectForm.audit.tbl.project_key_milestone'),
            project_sap_codes: t('projectForm.audit.tbl.project_sap_codes'),
            project_stage_weight: t('projectForm.audit.tbl.project_stage_weight'),
            project_contractor: t('projectForm.audit.tbl.project_contractor'),
            project_assignments: t('projectForm.audit.tbl.project_assignments'),
            project_equipment_plan: t('projectForm.audit.tbl.project_equipment_plan'),
            project_manpower_plan_month: t('projectForm.audit.tbl.project_manpower_plan_month'),
            project_shift_ratio: t('projectForm.audit.tbl.project_shift_ratio'),
          }}
        />
      )}
    </div>
  );
}
