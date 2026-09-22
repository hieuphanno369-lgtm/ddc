/**
 * Seed Postgres từ data mock (17 dự án + dims + history + 4 account).
 * Chạy sau migrate: `npx prisma db seed` (hoặc `npx tsx prisma/seed.ts`).
 */
import { PrismaClient } from '@prisma/client';
import { buildRepoData } from '../src/data/seed/history';

const prisma = new PrismaClient();

const d = (s: string | null | undefined): Date | null => (s ? new Date(s) : null);

async function main() {
  const data = buildRepoData();

  // Xoá project TRƯỚC dims: project giờ có FK thật tới customer/team/currency/stage/contractor/
  // equipment (Task 4), xoá dim trước sẽ dính RESTRICT vì project cũ còn tham chiếu. Cascade từ
  // project dọn sạch toàn bộ fact_*/project_* con, dims phía dưới xoá lại là an toàn.
  await prisma.project.deleteMany();

  // ---- Dims ----
  await prisma.customer.deleteMany();
  await prisma.customer.createMany({ data: data.customers });

  await prisma.teamKd.deleteMany();
  await prisma.teamKd.createMany({ data: data.teams });

  await prisma.factory.deleteMany();
  await prisma.factory.createMany({ data: data.factories });

  await prisma.currency.deleteMany();
  await prisma.currency.createMany({ data: data.currencies });

  await prisma.exchangeRate.deleteMany();
  await prisma.exchangeRate.createMany({ data: data.exchangeRates });

  await prisma.stage.deleteMany();
  await prisma.stage.createMany({ data: data.stages });

  await prisma.contractor.deleteMany();
  await prisma.contractor.createMany({ data: data.contractors });

  await prisma.equipment.deleteMany();
  await prisma.equipment.createMany({ data: data.equipments });

  // ---- Projects ----
  await prisma.project.deleteMany();
  await prisma.project.createMany({
    data: data.projects.map(({ createdAt: _c, updatedAt: _u, ...p }) => ({
      ...p,
      contractDate: d(p.contractDate),
      plannedStartDate: d(p.plannedStartDate),
      plannedFinishDate: d(p.plannedFinishDate),
      committedHandoverDate: d(p.committedHandoverDate),
      actualStartDate: d(p.actualStartDate),
      actualFinishDate: d(p.actualFinishDate),
    })),
  });

  await prisma.projectAlias.deleteMany();
  await prisma.projectAlias.createMany({
    data: data.aliases.map((a) => ({ ...a, effectiveFrom: new Date(a.effectiveFrom), effectiveTo: d(a.effectiveTo) })),
  });

  await prisma.projectSapCode.deleteMany();
  await prisma.projectSapCode.createMany({
    data: data.sapCodes.map((s) => ({ ...s, linkedAt: new Date(s.linkedAt) })),
  });

  await prisma.projectAssignment.deleteMany();
  await prisma.projectAssignment.createMany({
    data: data.assignments.map((a) => ({ ...a, assignedAt: new Date(a.assignedAt) })),
  });

  await prisma.projectStageWeight.deleteMany();
  await prisma.projectStageWeight.createMany({ data: data.stageWeights });

  await prisma.projectWorkItem.deleteMany();
  await prisma.projectWorkItem.createMany({ data: data.workItems });

  await prisma.projectKeyMilestone.deleteMany();
  await prisma.projectKeyMilestone.createMany({
    data: data.keyMilestones.map((m) => ({ ...m, plannedDate: d(m.plannedDate), actualDate: d(m.actualDate) })),
  });

  await prisma.projectContractor.deleteMany();
  await prisma.projectContractor.createMany({ data: data.projectContractors });

  // ---- Facts ----
  await prisma.factProgressMonthly.deleteMany();
  await prisma.factProgressMonthly.createMany({
    data: data.facts.map((f) => ({
      ...f,
      actualStartDate: d(f.actualStartDate),
      actualFinishDate: d(f.actualFinishDate),
      snapshotLockedAt: d(f.snapshotLockedAt),
      changedAt: d(f.changedAt),
    })),
  });

  await prisma.valueChainProgress.deleteMany();
  await prisma.valueChainProgress.createMany({ data: data.valueChain });

  await prisma.factFinancial.deleteMany();
  await prisma.factFinancial.createMany({
    data: data.financial.map((f) => ({ ...f, changedAt: d(f.changedAt) })),
  });

  await prisma.factVolume.deleteMany();
  await prisma.factVolume.createMany({ data: data.volumes });

  await prisma.factStageWorkItem.deleteMany();
  await prisma.factStageWorkItem.createMany({ data: data.workItemFacts });

  await prisma.factStageMilestone.deleteMany();
  await prisma.factStageMilestone.createMany({
    data: data.stageMilestones.map((m) => ({
      ...m,
      plannedStart: d(m.plannedStart), plannedFinish: d(m.plannedFinish),
      actualStart: d(m.actualStart), actualFinish: d(m.actualFinish),
      forecastDate: d(m.forecastDate), updatedAt: new Date(m.updatedAt),
    })),
  });

  await prisma.factDailyManpower.deleteMany();
  await prisma.factDailyManpower.createMany({
    data: data.dailyManpower.map((m) => ({ ...m, workDate: new Date(`${m.workDate}T00:00:00Z`) })),
  });

  await prisma.factDailyEquipmentUsage.deleteMany();
  await prisma.factDailyEquipmentUsage.createMany({
    data: data.dailyEquipment.map((e) => ({ ...e, workDate: new Date(`${e.workDate}T00:00:00Z`) })),
  });

  // ---- Logs / phụ ----
  await prisma.alertLog.deleteMany();
  await prisma.alertLog.createMany({
    data: data.alerts.map((a) => ({ ...a, openedAt: new Date(a.openedAt), closedAt: d(a.closedAt) })),
  });

  await prisma.projectPhoto.deleteMany();
  await prisma.projectPhoto.createMany({
    data: data.photos.map((p) => ({ ...p, uploadedAt: new Date(p.uploadedAt) })),
  });

  await prisma.sapQueue.deleteMany();
  await prisma.projectHistory.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.activityLog.deleteMany();

  // ---- User accounts (4, từ seed history) ----
  await prisma.userRole.deleteMany();
  await prisma.userRole.createMany({
    data: data.userRoles.map((u) => ({
      email: u.email,
      name: u.name,
      passwordHash: u.passwordHash,
      role: u.role,
      canViewFinance: u.canViewFinance,
      isActive: u.isActive,
      lastLoginAt: d(u.lastLoginAt),
    })),
  });

  // Sync autoincrement sequence sau createMany có id explicit (Prisma createMany KHÔNG bump sequence).
  await syncSequences();

  console.log('Seed xong: 17 dự án + 7 giai đoạn + 6 nhà thầu + 7 nhóm thiết bị + 10 hạng mục + 5 mốc chính');
}

/**
 * createMany với id explicit không advance sequence → insert sau (project/dim mới) dính
 * duplicate PK. Reset mọi sequence autoincrement về max(id) hiện tại.
 */
async function syncSequences() {
  const tables = [
    'dim_customer',
    'dim_team_kd',
    'dim_factory',
    'dim_project',
    'dim_project_alias',
    'project_sap_codes',
    'project_history',
    'alert_log',
    'audit_log',
    'project_photos',
    'sap_queue',
    'activity_log',
    'project_work_item',
    'project_key_milestone',
    'dim_contractor',
    'dim_equipment',
  ];
  for (const t of tables) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${t}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${t}), (SELECT MAX(id) IS NOT NULL FROM ${t}))`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
