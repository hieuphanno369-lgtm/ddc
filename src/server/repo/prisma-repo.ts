import { prisma } from '@/server/db';
import { DEFAULT_STAGE_WEIGHTS, type StageInput } from '@/lib/stages';
import { calcCpi, calcDayVariance, calcDurationPctComplete, calcEv, calcPv, calcSpi } from '@/lib/evm';
import { endOfMonth } from '@/lib/clock';
import type {
  ActivityLogEntry,
  AlertLog,
  AuditLogEntry,
  Contractor,
  Customer,
  Currency,
  CurrencyCode,
  Equipment,
  ExchangeRate,
  FactDailyEquipmentUsage,
  FactDailyManpower,
  FactFinancial,
  FactProgressMonthly,
  FactStageWorkItem,
  FactVolume,
  Factory,
  Market,
  Priority,
  Project,
  ProjectAlias,
  ProjectAssignment,
  ProjectContractor,
  ProjectHistoryEntry,
  ProjectKeyMilestone,
  ProjectPhoto,
  ProjectSapCode,
  ProjectStageWeight,
  ProjectType,
  ProjectWorkItem,
  Role,
  SapQueueItem,
  Stage,
  StageCalcMode,
  StageCode,
  StageMilestoneView,
  TeamKd,
  UserAccount,
  ValueChainProgress,
} from './types';

/**
 * Repository Prisma (Postgres) - cùng interface với mock-repo nhưng async.
 * Swap mock→Prisma: đổi import ở tầng trên từ './mock-repo' sang './prisma-repo'
 * (hoặc qua barrel './index'), không đổi tầng gọi.
 *
 * Append-only THẬT: fact/financial luôn INSERT bản mới (version += 1, isLatest = true)
 * trong 1 transaction hạ cờ bản cũ - không upsert đè, lịch sử version trước đó vẫn còn
 * nguyên trong bảng (đối chiếu audit_log + project_history khi cần).
 */

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const d8 = (s: string | null | undefined): Date | null => (s ? new Date(s) : null);
/** Date → 'YYYY-MM-DD' (cột @db.Date). */
const day = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
/** 'YYYY-MM-DD' → Date tại 00:00:00Z, để so sánh với cột @db.Date. */
const dayStart = (s: string): Date => new Date(`${s}T00:00:00Z`);

// ---- Mappers: Prisma row → app type (Date → ISO string) ----

function mapProject(p: {
  id: number; masterCode: string; currentAliasCode: string; projectName: string;
  customerId: number; teamKdId: number; marketCode: string; projectType: string;
  priority: string; contractValue: number; tonnage: number; currencyCode: string;
  contractDate: Date | null; plannedStartDate: Date | null; plannedFinishDate: Date | null;
  committedHandoverDate: Date | null; actualStartDate: Date | null; actualFinishDate: Date | null;
  penaltyValue: number | null; penalized: boolean; isActive: boolean;
  createdAt: Date; updatedAt: Date; createdBy: string; updatedBy: string;
}): Project {
  return {
    id: p.id,
    masterCode: p.masterCode,
    currentAliasCode: p.currentAliasCode,
    projectName: p.projectName,
    customerId: p.customerId,
    teamKdId: p.teamKdId,
    marketCode: p.marketCode as Market,
    projectType: p.projectType as ProjectType,
    priority: p.priority as Priority,
    contractValue: p.contractValue,
    tonnage: p.tonnage,
    currencyCode: p.currencyCode as CurrencyCode,
    contractDate: iso(p.contractDate),
    plannedStartDate: iso(p.plannedStartDate),
    plannedFinishDate: iso(p.plannedFinishDate),
    committedHandoverDate: iso(p.committedHandoverDate),
    actualStartDate: iso(p.actualStartDate),
    actualFinishDate: iso(p.actualFinishDate),
    penaltyValue: p.penaltyValue,
    penalized: p.penalized,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    createdBy: p.createdBy,
    updatedBy: p.updatedBy,
  };
}

function mapFact(f: {
  projectId: number; yearMonth: string; pctPlan: number; pctActual: number;
  actualStartDate: Date | null; actualFinishDate: Date | null; bac: number; pv: number; ev: number; ac: number;
  spi: number | null; cpi: number | null; bottleneckStage: string | null; isLatest: boolean;
  manpowerPlanned: number; manpowerActual: number;
  equipmentPlanned: number; equipmentActual: number; snapshotLockedAt: Date | null; lockedBy: string | null;
  version: number; changedBy: string; changedAt: Date | null; changeNote: string;
}): FactProgressMonthly {
  return {
    projectId: f.projectId,
    yearMonth: f.yearMonth,
    pctPlan: f.pctPlan,
    pctActual: f.pctActual,
    actualStartDate: iso(f.actualStartDate),
    actualFinishDate: iso(f.actualFinishDate),
    bac: f.bac,
    pv: f.pv,
    ev: f.ev,
    ac: f.ac,
    spi: f.spi,
    cpi: f.cpi,
    bottleneckStage: (f.bottleneckStage ?? null) as FactProgressMonthly['bottleneckStage'],
    isLatest: f.isLatest,
    manpowerPlanned: f.manpowerPlanned,
    manpowerActual: f.manpowerActual,
    equipmentPlanned: f.equipmentPlanned,
    equipmentActual: f.equipmentActual,
    snapshotLockedAt: iso(f.snapshotLockedAt),
    lockedBy: f.lockedBy,
    version: f.version,
    changedBy: f.changedBy,
    changedAt: iso(f.changedAt) ?? '',
    changeNote: f.changeNote,
  };
}

function mapFinancial(f: {
  projectId: number; yearMonth: string; revenuePeriod: number; revenueCumulative: number;
  costActualPeriod: number; costActualCumulative: number; grossProfit: number; grossMarginPct: number;
  backlog: number; arCollected: number; arOutstanding: number; arOverdue: number;
  version: number; isLatest: boolean; changedBy: string; changedAt: Date | null; changeNote: string;
}): FactFinancial {
  return {
    projectId: f.projectId,
    yearMonth: f.yearMonth,
    revenuePeriod: f.revenuePeriod,
    revenueCumulative: f.revenueCumulative,
    costActualPeriod: f.costActualPeriod,
    costActualCumulative: f.costActualCumulative,
    grossProfit: f.grossProfit,
    grossMarginPct: f.grossMarginPct,
    backlog: f.backlog,
    arCollected: f.arCollected,
    arOutstanding: f.arOutstanding,
    arOverdue: f.arOverdue,
    version: f.version,
    isLatest: f.isLatest,
    changedBy: f.changedBy,
    changedAt: iso(f.changedAt) ?? '',
    changeNote: f.changeNote,
  };
}

export const repo = {
  // ---- Reads ----
  async listProjects(): Promise<Project[]> {
    const rows = await prisma.project.findMany({ where: { isActive: true } });
    return rows.map(mapProject);
  },

  async getProject(id: number): Promise<Project | undefined> {
    const p = await prisma.project.findFirst({ where: { id, isActive: true } });
    return p ? mapProject(p) : undefined;
  },

  async getFacts(projectId: number): Promise<FactProgressMonthly[]> {
    const rows = await prisma.factProgressMonthly.findMany({
      where: { projectId, isLatest: true },
      orderBy: { yearMonth: 'asc' },
    });
    return rows.map(mapFact);
  },

  async getLatestFact(projectId: number, yearMonth: string): Promise<FactProgressMonthly | undefined> {
    const row = await prisma.factProgressMonthly.findFirst({
      where: { projectId, isLatest: true, ...(yearMonth === 'all' ? {} : { yearMonth }) },
      orderBy: { yearMonth: 'desc' },
    });
    return row ? mapFact(row) : undefined;
  },

  async getFactsForMonth(yearMonth: string): Promise<FactProgressMonthly[]> {
    if (yearMonth === 'all') {
      const rows = await prisma.factProgressMonthly.findMany({ where: { isLatest: true }, orderBy: { yearMonth: 'asc' } });
      const map = new Map<number, FactProgressMonthly>();
      for (const f of rows.map(mapFact)) map.set(f.projectId, f); // last = latest (asc order)
      return [...map.values()];
    }
    const rows = await prisma.factProgressMonthly.findMany({ where: { yearMonth, isLatest: true } });
    return rows.map(mapFact);
  },

  async getValueChain(projectId: number, yearMonth: string): Promise<ValueChainProgress[]> {
    const rows = await prisma.valueChainProgress.findMany({ where: { projectId, yearMonth } });
    return rows.map((v) => ({
      projectId: v.projectId,
      stageCode: v.stageCode as ValueChainProgress['stageCode'],
      yearMonth: v.yearMonth,
      pctComplete: v.pctComplete,
      applicable: v.applicable,
    }));
  },

  // ---- ERP v2 ----
  async getStages(): Promise<Stage[]> {
    const rows = await prisma.stage.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map((s) => ({
      code: s.code as StageCode, nameVi: s.nameVi, nameEn: s.nameEn,
      sortOrder: s.sortOrder, calcMode: s.calcMode as StageCalcMode,
    }));
  },

  /** Chưa cấu hình trọng số → rơi về bộ mặc định, KHÔNG trả mảng rỗng (sẽ làm %TT = 0). */
  async getStageWeights(projectId: number): Promise<ProjectStageWeight[]> {
    const rows = await prisma.projectStageWeight.findMany({ where: { projectId } });
    if (!rows.length) {
      return DEFAULT_STAGE_WEIGHTS.map((w) => ({
        projectId, stageCode: w.stageCode, weightPct: w.weightPct, applicable: w.applicable,
      }));
    }
    return rows.map((w) => ({
      projectId: w.projectId, stageCode: w.stageCode as StageCode,
      weightPct: w.weightPct, applicable: w.applicable,
    }));
  },

  async getWorkItems(projectId: number): Promise<ProjectWorkItem[]> {
    return prisma.projectWorkItem.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } });
  },

  async getWorkItemFacts(projectId: number, yearMonth: string, stageCode?: StageCode): Promise<FactStageWorkItem[]> {
    const rows = await prisma.factStageWorkItem.findMany({
      where: { projectId, yearMonth, ...(stageCode ? { stageCode } : {}) },
    });
    return rows.map((f) => ({ ...f, stageCode: f.stageCode as StageCode }));
  },

  /** Trả StageMilestoneView: 5 cột DB + "Ngày chênh lệch" tính runtime (Q1) - giống hệt mock-repo. */
  async getStageMilestones(projectId: number): Promise<StageMilestoneView[]> {
    const rows = await prisma.factStageMilestone.findMany({
      where: { projectId },
      orderBy: { stage: { sortOrder: 'asc' } },
    });
    return rows.map((m) => ({
      projectId: m.projectId, stageCode: m.stageCode as StageCode,
      plannedStart: day(m.plannedStart), plannedFinish: day(m.plannedFinish),
      actualStart: day(m.actualStart), actualFinish: day(m.actualFinish),
      forecastDate: day(m.forecastDate),
      dayVariance: calcDayVariance(day(m.plannedFinish), day(m.actualFinish)),
      updatedAt: m.updatedAt.toISOString(), updatedBy: m.updatedBy,
    }));
  },

  async getKeyMilestones(projectId: number): Promise<ProjectKeyMilestone[]> {
    const rows = await prisma.projectKeyMilestone.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } });
    return rows.map((m) => ({
      id: m.id, projectId: m.projectId, name: m.name, sortOrder: m.sortOrder,
      plannedDate: day(m.plannedDate), actualDate: day(m.actualDate),
    }));
  },

  async getContractors(projectId?: number): Promise<Contractor[]> {
    return prisma.contractor.findMany({
      where: { isActive: true, ...(projectId != null ? { projects: { some: { projectId } } } : {}) },
      orderBy: { id: 'asc' },
    });
  },

  async getEquipments(): Promise<Equipment[]> {
    return prisma.equipment.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
  },

  async getDailyManpower(projectId: number, from: string, to: string): Promise<FactDailyManpower[]> {
    const rows = await prisma.factDailyManpower.findMany({
      where: { projectId, workDate: { gte: dayStart(from), lte: dayStart(to) } },
      orderBy: [{ workDate: 'asc' }, { contractorId: 'asc' }],
    });
    return rows.map((m) => ({ ...m, workDate: day(m.workDate)! }));
  },

  async getDailyEquipment(projectId: number, from: string, to: string): Promise<FactDailyEquipmentUsage[]> {
    const rows = await prisma.factDailyEquipmentUsage.findMany({
      where: { projectId, workDate: { gte: dayStart(from), lte: dayStart(to) } },
      orderBy: [{ workDate: 'asc' }, { contractorId: 'asc' }, { equipmentId: 'asc' }],
    });
    return rows.map((e) => ({ ...e, workDate: day(e.workDate)! }));
  },

  async getFinancial(projectId: number): Promise<FactFinancial[]> {
    const rows = await prisma.factFinancial.findMany({
      where: { projectId, isLatest: true },
      orderBy: { yearMonth: 'asc' },
    });
    return rows.map(mapFinancial);
  },

  async getFinancialForMonth(yearMonth: string): Promise<FactFinancial[]> {
    if (yearMonth === 'all') {
      const rows = await prisma.factFinancial.findMany({ where: { isLatest: true }, orderBy: { yearMonth: 'asc' } });
      const map = new Map<number, FactFinancial>();
      for (const f of rows.map(mapFinancial)) map.set(f.projectId, f);
      return [...map.values()];
    }
    const rows = await prisma.factFinancial.findMany({ where: { yearMonth, isLatest: true } });
    return rows.map(mapFinancial);
  },

  async getVolumesForMonth(yearMonth: string): Promise<FactVolume[]> {
    if (yearMonth === 'all') {
      const rows = await prisma.factVolume.findMany({ orderBy: { yearMonth: 'asc' } });
      const map = new Map<string, FactVolume>();
      for (const v of rows) map.set(`${v.projectId}|${v.factoryId}`, v);
      return [...map.values()];
    }
    return prisma.factVolume.findMany({ where: { yearMonth } });
  },

  async getAlerts(projectId?: number): Promise<AlertLog[]> {
    const rows = await prisma.alertLog.findMany({
      ...(projectId ? { where: { projectId } } : {}),
      orderBy: { openedAt: 'desc' },
    });
    return rows.map((a) => ({
      id: a.id,
      projectId: a.projectId,
      alertType: a.alertType as AlertLog['alertType'],
      ruleTriggered: a.ruleTriggered,
      message: a.message,
      openedAt: a.openedAt.toISOString(),
      closedAt: iso(a.closedAt),
      owner: a.owner,
      action: a.action,
      deadline: a.deadline,
    }));
  },

  async getAliases(projectId: number): Promise<ProjectAlias[]> {
    const rows = await prisma.projectAlias.findMany({
      where: { projectId },
      orderBy: { effectiveFrom: 'asc' },
    });
    return rows.map((a) => ({
      id: a.id,
      projectId: a.projectId,
      aliasCode: a.aliasCode,
      aliasType: a.aliasType as ProjectAlias['aliasType'],
      effectiveFrom: a.effectiveFrom.toISOString(),
      effectiveTo: iso(a.effectiveTo),
      reason: a.reason,
      approvedBy: a.approvedBy,
    }));
  },

  async getSapCodes(projectId?: number): Promise<ProjectSapCode[]> {
    const rows = await prisma.projectSapCode.findMany(projectId ? { where: { projectId } } : undefined);
    return rows.map((s) => ({
      id: s.id,
      projectId: s.projectId,
      sapCode: s.sapCode,
      sourceDocType: s.sourceDocType,
      linkedAt: s.linkedAt.toISOString(),
      linkedBy: s.linkedBy,
      note: s.note,
    }));
  },

  async getPhotos(projectId: number, yearMonth?: string): Promise<ProjectPhoto[]> {
    const rows = await prisma.projectPhoto.findMany({
      where: { projectId, ...(yearMonth ? { yearMonth } : {}) },
      orderBy: { uploadedAt: 'desc' },
    });
    return rows.map((p) => ({
      id: p.id,
      projectId: p.projectId,
      yearMonth: p.yearMonth,
      url: p.url,
      caption: p.caption,
      uploadedBy: p.uploadedBy,
      uploadedAt: p.uploadedAt.toISOString(),
    }));
  },

  async getPhotoById(photoId: number): Promise<ProjectPhoto | null> {
    const p = await prisma.projectPhoto.findUnique({ where: { id: photoId } });
    if (!p) return null;
    return {
      id: p.id,
      projectId: p.projectId,
      yearMonth: p.yearMonth,
      url: p.url,
      caption: p.caption,
      uploadedBy: p.uploadedBy,
      uploadedAt: p.uploadedAt.toISOString(),
    };
  },

  async addPhoto(
    projectId: number,
    yearMonth: string,
    url: string,
    caption: string,
    uploadedBy: string,
  ): Promise<ProjectPhoto> {
    const p = await prisma.projectPhoto.create({ data: { projectId, yearMonth, url, caption, uploadedBy } });
    return {
      id: p.id,
      projectId: p.projectId,
      yearMonth: p.yearMonth,
      url: p.url,
      caption: p.caption,
      uploadedBy: p.uploadedBy,
      uploadedAt: p.uploadedAt.toISOString(),
    };
  },

  async deletePhoto(photoId: number): Promise<boolean> {
    try {
      await prisma.projectPhoto.delete({ where: { id: photoId } });
      return true;
    } catch {
      return false;
    }
  },

  async getDims(): Promise<{
    customers: Customer[]; teams: TeamKd[]; factories: Factory[];
    currencies: Currency[]; exchangeRates: ExchangeRate[];
  }> {
    const [customers, teams, factories, currencies, exchangeRates] = await Promise.all([
      prisma.customer.findMany({ where: { isActive: true } }),
      prisma.teamKd.findMany({ where: { isActive: true } }),
      prisma.factory.findMany(),
      prisma.currency.findMany(),
      prisma.exchangeRate.findMany(),
    ]);
    return {
      customers: customers.map((c) => ({
        id: c.id, name: c.name, group: c.group, aliases: c.aliases,
        isActive: c.isActive, mergedIntoId: c.mergedIntoId,
      })),
      teams: teams.map((t) => ({
        id: t.id, name: t.name, picName: t.picName, aliases: t.aliases,
        isActive: t.isActive, mergedIntoId: t.mergedIntoId,
      })),
      factories: factories.map((f) => ({
        id: f.id, name: f.name, region: f.region, capacityTonPerYear: f.capacityTonPerYear,
      })),
      currencies: currencies.map((c) => ({ code: c.code as CurrencyCode, name: c.name })),
      exchangeRates: exchangeRates.map((e) => ({
        currencyCode: e.currencyCode as CurrencyCode, yearMonth: e.yearMonth, rateToVnd: e.rateToVnd,
      })),
    };
  },

  // ---- RBAC ----
  async getAssignmentsForUser(email: string): Promise<number[]> {
    const rows = await prisma.projectAssignment.findMany({ where: { userEmail: email } });
    return rows.map((a) => a.projectId);
  },

  async getAssignments(): Promise<ProjectAssignment[]> {
    const rows = await prisma.projectAssignment.findMany();
    return rows.map((a) => ({
      projectId: a.projectId,
      userEmail: a.userEmail,
      roleInProject: a.roleInProject as ProjectAssignment['roleInProject'],
      assignedBy: a.assignedBy,
      assignedAt: a.assignedAt.toISOString(),
    }));
  },

  // ---- Dim chuẩn hóa ----
  async suggestDim(field: 'customer' | 'team', query: string): Promise<{ id: number; name: string }[]> {
    const q = query.toLowerCase().trim();
    const list = field === 'customer'
      ? await prisma.customer.findMany({ where: { isActive: true } })
      : await prisma.teamKd.findMany({ where: { isActive: true } });
    return list
      .filter((x) => !q || x.name.toLowerCase().includes(q) || x.aliases.some((a) => a.toLowerCase().includes(q)))
      .map((x) => ({ id: x.id, name: x.name }));
  },

  async createDimValue(field: 'customer' | 'team', name: string): Promise<number> {
    const n = name.trim();
    const existing = await this.suggestDim(field, '');
    const match = existing.find((x) => x.name.toLowerCase() === n.toLowerCase());
    if (match) return match.id;
    if (field === 'customer') {
      const c = await prisma.customer.create({ data: { name: n, group: 'Khác' } });
      return c.id;
    }
    const t = await prisma.teamKd.create({ data: { name: n, picName: '-' } });
    return t.id;
  },

  async renameDimValue(field: 'customer' | 'team', id: number, newName: string) {
    if (field === 'customer') {
      const x = await prisma.customer.findUnique({ where: { id } });
      if (!x || x.name === newName) return;
      const aliases = x.aliases.includes(x.name) ? x.aliases : [...x.aliases, x.name];
      await prisma.customer.update({ where: { id }, data: { name: newName, aliases } });
    } else {
      const x = await prisma.teamKd.findUnique({ where: { id } });
      if (!x || x.name === newName) return;
      const aliases = x.aliases.includes(x.name) ? x.aliases : [...x.aliases, x.name];
      await prisma.teamKd.update({ where: { id }, data: { name: newName, aliases } });
    }
  },

  async mergeDimValue(field: 'customer' | 'team', fromId: number, toId: number): Promise<number> {
    if (fromId === toId) return 0;
    if (field === 'customer') {
      const from = await prisma.customer.findUnique({ where: { id: fromId } });
      const to = await prisma.customer.findUnique({ where: { id: toId } });
      if (!from || !to) return 0;
      const r = await prisma.project.updateMany({ where: { customerId: fromId }, data: { customerId: toId } });
      const aliases = [...to.aliases];
      if (!aliases.includes(from.name)) aliases.push(from.name);
      for (const a of from.aliases) if (!aliases.includes(a)) aliases.push(a);
      await prisma.customer.update({ where: { id: toId }, data: { aliases } });
      await prisma.customer.update({ where: { id: fromId }, data: { isActive: false, mergedIntoId: toId } });
      return r.count;
    }
    const from = await prisma.teamKd.findUnique({ where: { id: fromId } });
    const to = await prisma.teamKd.findUnique({ where: { id: toId } });
    if (!from || !to) return 0;
    const r = await prisma.project.updateMany({ where: { teamKdId: fromId }, data: { teamKdId: toId } });
    const aliases = [...to.aliases];
    if (!aliases.includes(from.name)) aliases.push(from.name);
    for (const a of from.aliases) if (!aliases.includes(a)) aliases.push(a);
    await prisma.teamKd.update({ where: { id: toId }, data: { aliases } });
    await prisma.teamKd.update({ where: { id: fromId }, data: { isActive: false, mergedIntoId: toId } });
    return r.count;
  },

  async getDimFieldValues(field: 'customer' | 'team') {
    const projects = await prisma.project.findMany({ select: { customerId: true, teamKdId: true } });
    const list = field === 'customer'
      ? await prisma.customer.findMany()
      : await prisma.teamKd.findMany();
    return list.map((x) => ({
      id: x.id,
      name: x.name,
      isActive: x.isActive,
      mergedIntoId: x.mergedIntoId,
      refCount: projects.filter((p) => (field === 'customer' ? p.customerId : p.teamKdId) === x.id).length,
    }));
  },

  async getProjectHistory(): Promise<ProjectHistoryEntry[]> {
    const rows = await prisma.projectHistory.findMany({ orderBy: { at: 'desc' } });
    return rows.map((h) => ({
      at: h.at.toISOString(),
      by: h.by,
      note: h.note,
      snapshot: h.snapshot as unknown as Project,
    }));
  },

  // ---- User accounts ----
  async getUserRoles(): Promise<UserAccount[]> {
    const rows = await prisma.userRole.findMany({ orderBy: { email: 'asc' } });
    return rows.map((u) => ({
      email: u.email,
      name: u.name,
      passwordHash: u.passwordHash,
      role: u.role as Role,
      canViewFinance: u.canViewFinance,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: iso(u.lastLoginAt),
    }));
  },

  async findAccount(email: string): Promise<UserAccount | undefined> {
    const u = await prisma.userRole.findUnique({ where: { email: email.toLowerCase() } });
    if (!u) return undefined;
    return {
      email: u.email,
      name: u.name,
      passwordHash: u.passwordHash,
      role: u.role as Role,
      canViewFinance: u.canViewFinance,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: iso(u.lastLoginAt),
    };
  },

  async createAccount(account: UserAccount) {
    await prisma.userRole.create({
      data: {
        email: account.email,
        name: account.name,
        passwordHash: account.passwordHash,
        role: account.role,
        canViewFinance: account.canViewFinance,
        isActive: account.isActive,
        lastLoginAt: null,
      },
    });
  },

  async setUserRole(email: string, role: Role, canViewFinance: boolean) {
    await prisma.userRole.updateMany({
      where: { email: email.toLowerCase() },
      data: { role, canViewFinance },
    });
  },

  async removeUserRole(email: string) {
    await prisma.userRole.deleteMany({ where: { email: email.toLowerCase() } });
  },

  async changePassword(email: string, passwordHash: string) {
    await prisma.userRole.updateMany({
      where: { email: email.toLowerCase() },
      data: { passwordHash },
    });
  },

  async updateLastLogin(email: string) {
    await prisma.userRole.updateMany({
      where: { email: email.toLowerCase() },
      data: { lastLoginAt: new Date() },
    });
  },

  async setAccountActive(email: string, isActive: boolean) {
    await prisma.userRole.updateMany({
      where: { email: email.toLowerCase() },
      data: { isActive },
    });
  },

  // ---- Audit log ----
  async getAuditLog(): Promise<AuditLogEntry[]> {
    const rows = await prisma.auditLog.findMany({ orderBy: { changedAt: 'desc' } });
    return rows.map((a) => ({
      id: a.id,
      tableName: a.tableName,
      recordId: a.recordId,
      field: a.field,
      oldValue: a.oldValue,
      newValue: a.newValue,
      changedBy: a.changedBy,
      changedAt: a.changedAt.toISOString(),
    }));
  },

  async logAudit(
    tableName: string, recordId: string, field: string,
    oldValue: string, newValue: string, changedBy: string,
  ) {
    await prisma.auditLog.create({
      data: { tableName, recordId, field, oldValue, newValue, changedBy },
    });
  },

  // ---- Activity log (retention 14 ngày) ----
  async getActivity(): Promise<ActivityLogEntry[]> {
    const rows = await prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((a) => ({
      id: a.id,
      userEmail: a.userEmail,
      userName: a.userName,
      action: a.action,
      detail: a.detail,
      ip: a.ip,
      userAgent: a.userAgent,
      createdAt: a.createdAt.toISOString(),
    }));
  },

  async logActivity(entry: { userEmail: string; userName: string; action: string; detail: string; ip: string; userAgent: string }) {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    await prisma.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    await prisma.activityLog.create({ data: entry });
  },

  // ---- SAP queue ----
  async getSapQueue(): Promise<SapQueueItem[]> {
    const rows = await prisma.sapQueue.findMany();
    return rows.map((q) => ({
      id: q.id,
      sapCode: q.sapCode,
      sourceDocType: q.sourceDocType,
      projectNameHint: q.projectNameHint,
      status: q.status as SapQueueItem['status'],
      projectId: q.projectId,
      detectedAt: q.detectedAt.toISOString(),
    }));
  },

  async addSapQueueItem(sapCode: string, sourceDocType: string, projectNameHint: string) {
    await prisma.sapQueue.create({ data: { sapCode, sourceDocType, projectNameHint } });
  },

  async resolveSapQueue(id: number, projectId: number): Promise<boolean> {
    const r = await prisma.sapQueue.updateMany({
      where: { id },
      data: { status: 'resolved', projectId },
    });
    return r.count > 0;
  },

  // ---- Snapshot / lock ----
  async lockMonth(yearMonth: string, lockedBy: string) {
    await prisma.factProgressMonthly.updateMany({
      where: { yearMonth, isLatest: true },
      data: { snapshotLockedAt: new Date(), lockedBy },
    });
  },

  async isMonthLocked(yearMonth: string): Promise<boolean> {
    const [total, locked] = await Promise.all([
      prisma.factProgressMonthly.count({ where: { yearMonth, isLatest: true } }),
      prisma.factProgressMonthly.count({ where: { yearMonth, isLatest: true, snapshotLockedAt: { not: null } } }),
    ]);
    return total > 0 && locked === total;
  },

  // ---- Mutations ----
  async saveMonthlyFact(
    projectId: number,
    yearMonth: string,
    patch: Partial<Pick<FactProgressMonthly,
      'pctPlan' | 'pctActual' | 'ac' | 'equipmentActual' | 'manpowerActual' | 'bottleneckStage'>>,
    changedBy = 'system',
  ) {
    const prev = await this.getLatestFact(projectId, yearMonth);
    if (!prev) return;
    const proj = await prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) return;

    const fields = Object.keys(patch) as (keyof typeof patch)[];
    const note = fields.map((k) => `${k}: ${String(prev[k])} → ${String(patch[k])}`).join('; ');
    const bac = proj.contractValue;                 // snapshot BAC tại thời điểm ghi
    const pctPlan = patch.pctPlan ?? prev.pctPlan;  // số nhập tay - chỉ lưu để audit (Q2)
    const pctActual = patch.pctActual ?? prev.pctActual;
    const ac = patch.ac ?? prev.ac;
    // % KH = thời gian đã trôi tới CUỐI THÁNG đang lưu, không phải số nhập tay, không phải "hôm nay".
    const at = new Date(`${endOfMonth(yearMonth)}T00:00:00Z`);
    const pctPlanDuration = calcDurationPctComplete(proj.plannedStartDate, proj.plannedFinishDate, at) ?? 0;
    const pv = calcPv(pctPlanDuration, bac);
    const ev = calcEv(pctActual, bac);

    // Append-only: hạ cờ bản cũ rồi INSERT bản mới, trong CÙNG 1 transaction.
    // Partial unique index ux_fact_progress_latest chặn 2 dòng isLatest cùng lúc.
    await prisma.$transaction([
      prisma.factProgressMonthly.updateMany({
        where: { projectId, yearMonth, isLatest: true },
        data: { isLatest: false },
      }),
      prisma.factProgressMonthly.create({
        data: {
          projectId, yearMonth,
          version: prev.version + 1,
          isLatest: true,
          pctPlan, pctActual, ac, pv, ev,
          spi: calcSpi(ev, pv),
          cpi: calcCpi(ev, ac),
          bac,
          actualStartDate: d8(prev.actualStartDate),
          actualFinishDate: d8(prev.actualFinishDate),
          bottleneckStage: patch.bottleneckStage !== undefined ? patch.bottleneckStage : prev.bottleneckStage,
          manpowerPlanned: prev.manpowerPlanned,
          manpowerActual: patch.manpowerActual ?? prev.manpowerActual,
          equipmentPlanned: prev.equipmentPlanned,     // KHÔNG hardcode 0 nữa - đó là lý do
          equipmentActual: patch.equipmentActual ?? prev.equipmentActual, // isEquipmentWarning không bao giờ chạy
          snapshotLockedAt: d8(prev.snapshotLockedAt),
          lockedBy: prev.lockedBy,
          changedBy, changedAt: new Date(), changeNote: note,
        },
      }),
      prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } }),
    ]);
    await this.logAudit('fact_progress_monthly', `${projectId}/${yearMonth}`, fields.join(','), '', note, changedBy);
  },

  async saveValueChain(
    projectId: number,
    yearMonth: string,
    stages: StageInput[],
    changedBy = 'system',
  ) {
    await prisma.$transaction(
      stages.map((s) =>
        prisma.valueChainProgress.upsert({
          where: { projectId_stageCode_yearMonth: { projectId, stageCode: s.stageCode, yearMonth } },
          create: { projectId, stageCode: s.stageCode, yearMonth, pctComplete: s.pctComplete, applicable: s.applicable },
          update: { pctComplete: s.pctComplete, applicable: s.applicable },
        }),
      ),
    );
    await this.logAudit(
      'fact_value_chain_progress', `${projectId}/${yearMonth}`, 'pctComplete', '',
      stages.map((s) => `${s.stageCode}:${s.pctComplete}/${s.applicable}`).join(','), changedBy,
    );
  },

  async importMonthlyFacts(yearMonth: string, rows: { projectId: number; pctActual: number }[], changedBy = 'system') {
    let n = 0;
    for (const r of rows) {
      const exists = await this.getLatestFact(r.projectId, yearMonth);
      if (!exists) continue;
      await this.saveMonthlyFact(r.projectId, yearMonth, { pctActual: r.pctActual }, changedBy);
      n++;
    }
    return n;
  },

  async saveFinancial(
    projectId: number,
    yearMonth: string,
    patch: Partial<Pick<FactFinancial, 'revenueCumulative' | 'costActualCumulative' | 'arCollected' | 'arOutstanding' | 'arOverdue'>>,
    changedBy = 'system',
  ) {
    const prev = await prisma.factFinancial.findFirst({
      where: { projectId, yearMonth, isLatest: true },
    });
    if (!prev) return;
    const fields = Object.keys(patch) as (keyof typeof patch)[];
    const note = fields.map((k) => `${k}: ${String(prev[k])} → ${String(patch[k])}`).join('; ');
    const proj = await prisma.project.findUnique({ where: { id: projectId } });
    const contractValue = proj?.contractValue ?? 0;
    const collected = patch.arCollected ?? prev.arCollected;
    const overdue = patch.arOverdue ?? prev.arOverdue;
    const revenueCumulative = patch.revenueCumulative ?? prev.revenueCumulative;
    const costActualCumulative = patch.costActualCumulative ?? prev.costActualCumulative;
    const arOutstanding = Math.round((contractValue - collected - overdue) * 10) / 10;
    const grossProfit = Math.round((revenueCumulative - costActualCumulative) * 10) / 10;
    const grossMarginPct = revenueCumulative ? (revenueCumulative - costActualCumulative) / revenueCumulative : 0;

    // Append-only: hạ cờ bản cũ rồi INSERT bản mới, trong CÙNG 1 transaction (giống saveMonthlyFact).
    await prisma.$transaction([
      prisma.factFinancial.updateMany({
        where: { projectId, yearMonth, isLatest: true },
        data: { isLatest: false },
      }),
      prisma.factFinancial.create({
        data: {
          projectId, yearMonth,
          version: prev.version + 1,
          isLatest: true,
          revenuePeriod: prev.revenuePeriod, revenueCumulative,
          costActualPeriod: prev.costActualPeriod, costActualCumulative,
          grossProfit, grossMarginPct, backlog: prev.backlog,
          arCollected: collected, arOutstanding, arOverdue: overdue,
          changedBy, changedAt: new Date(), changeNote: note,
        },
      }),
    ]);
    await this.logAudit('fact_financial', `${projectId}/${yearMonth}`, fields.join(','), '', note, changedBy);
  },

  async saveProjectProfile(projectId: number, patch: Partial<Project>, changedBy = 'system') {
    const p = await prisma.project.findUnique({ where: { id: projectId } });
    if (!p) return;
    const fields = Object.keys(patch) as (keyof Project)[];
    const note = fields
      .map((k) => `${k}: ${String((p as unknown as Record<string, unknown>)[k])} → ${String((patch as unknown as Record<string, unknown>)[k])}`)
      .join('; ');
    const now = new Date();
    await prisma.projectHistory.create({
      data: { projectId, at: now, by: changedBy, note, snapshot: p as unknown as object },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: {
        ...patch,
        contractDate: patch.contractDate !== undefined ? d8(patch.contractDate) : undefined,
        plannedStartDate: patch.plannedStartDate !== undefined ? d8(patch.plannedStartDate) : undefined,
        plannedFinishDate: patch.plannedFinishDate !== undefined ? d8(patch.plannedFinishDate) : undefined,
        committedHandoverDate: patch.committedHandoverDate !== undefined ? d8(patch.committedHandoverDate) : undefined,
        actualStartDate: patch.actualStartDate !== undefined ? d8(patch.actualStartDate) : undefined,
        actualFinishDate: patch.actualFinishDate !== undefined ? d8(patch.actualFinishDate) : undefined,
        updatedAt: now,
        updatedBy: changedBy,
      },
    });
    await this.logAudit('dim_project', String(projectId), fields.join(','), '', note, changedBy);
  },

  async createProject(
    input: {
      projectName: string; customerId: number; teamKdId: number; marketCode: Market;
      projectType: ProjectType; priority: Priority; contractValue: number; tonnage?: number;
      currencyCode?: CurrencyCode; contractDate?: string | null; plannedStartDate?: string | null;
      plannedFinishDate?: string | null; committedHandoverDate?: string | null; penaltyValue?: number | null;
    },
    changedBy = 'system',
  ): Promise<Project> {
    const tmp = `TMP-${Date.now()}`;
    const created = await prisma.project.create({
      data: {
        masterCode: tmp,
        currentAliasCode: tmp,
        projectName: input.projectName,
        customerId: input.customerId,
        teamKdId: input.teamKdId,
        marketCode: input.marketCode,
        projectType: input.projectType,
        priority: input.priority,
        contractValue: input.contractValue,
        tonnage: input.tonnage ?? 0,
        currencyCode: input.currencyCode ?? 'VND',
        contractDate: d8(input.contractDate ?? null),
        plannedStartDate: d8(input.plannedStartDate ?? null),
        plannedFinishDate: d8(input.plannedFinishDate ?? null),
        committedHandoverDate: d8(input.committedHandoverDate ?? null),
        penaltyValue: input.penaltyValue ?? null,
        createdBy: changedBy,
        updatedBy: changedBy,
      },
    });
    const code = `M-${String(created.id).padStart(5, '0')}`;
    const p = await prisma.project.update({
      where: { id: created.id },
      data: { masterCode: code, currentAliasCode: code },
    });
    await this.logAudit('dim_project', String(p.id), 'create', '', p.projectName, changedBy);
    return mapProject(p);
  },

  async addAssignment(projectId: number, userEmail: string, roleInProject: 'PIC' | 'Backup' = 'PIC') {
    await prisma.projectAssignment.upsert({
      where: { projectId_userEmail: { projectId, userEmail } },
      create: { projectId, userEmail, roleInProject, assignedBy: 'system' },
      update: { roleInProject },
    });
  },

  async closeAlert(id: number, action: string, changedBy = 'system') {
    await prisma.alertLog.update({ where: { id }, data: { closedAt: new Date(), action } });
    await this.logAudit('alert_log', String(id), 'action', '', action, changedBy);
  },

  async addSapCode(projectId: number, sapCode: string, sourceDocType: string, changedBy = 'system'): Promise<boolean> {
    const existing = await prisma.projectSapCode.findUnique({ where: { sapCode } });
    if (existing) return false;
    await prisma.projectSapCode.create({
      data: { projectId, sapCode, sourceDocType, linkedBy: changedBy, note: '' },
    });
    await this.logAudit('project_sap_codes', String(projectId), 'sapCode', '', sapCode, changedBy);
    return true;
  },

  async removeProject(id: number) {
    const proj = await prisma.project.findUnique({ where: { id } });
    if (!proj) return;
    // FK onDelete: Cascade khai ở schema tự dọn mọi bảng con - không xoá tay từng bảng nữa.
    await prisma.project.delete({ where: { id } });
    // dim cleanup: chỉ xoá customer/team khi không còn dự án nào dùng (FK Restrict sẽ chặn nếu còn).
    const stillUsesCustomer = await prisma.project.findFirst({ where: { customerId: proj.customerId } });
    if (!stillUsesCustomer) await prisma.customer.deleteMany({ where: { id: proj.customerId } });
    const stillUsesTeam = await prisma.project.findFirst({ where: { teamKdId: proj.teamKdId } });
    if (!stillUsesTeam) await prisma.teamKd.deleteMany({ where: { id: proj.teamKdId } });
  },

  async resetAllData() {
    // cascade dọn hết bảng con (fact_*, value_chain_progress, project_stage_weight, project_work_item…).
    // KHÔNG xoá stage/contractor/equipment/customer/teamKd/factory/currency - đó là dimension.
    // sap_queue.projectId là ON DELETE SET NULL (không phải Cascade) nên không tự dọn theo -
    // phải xoá tay, khớp hành vi mock-repo.resetAllData (đang gán d.sapQueue = []).
    await prisma.$transaction([
      prisma.project.deleteMany(),
      prisma.auditLog.deleteMany(),
      prisma.sapQueue.deleteMany(),
    ]);
  },
};
