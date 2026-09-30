import { calcDurationPctComplete, calcSpi, findBottleneck, penaltyState } from '@/lib/evm';
import { THRESHOLDS } from '@/lib/thresholds';
import { LEGACY_STAGE_WEIGHTS, SEED_STAGE_CODES } from '@/lib/stages';
import { endOfMonth } from '@/lib/clock';
import { handoverKey, monthKey } from '@/lib/alert-keys';
import { hashSync } from 'bcryptjs';
import type {
  ActivityLogEntry,
  AlertLog,
  AuditLogEntry,
  Contractor,
  Equipment,
  FactDailyEquipmentUsage,
  FactDailyManpowerShift,
  FactFinancial,
  FactProgressMonthly,
  FactStageWorkItem,
  FactStageMilestone,
  FactVolume,
  JobRunEntry,
  Project,
  ProjectAlias,
  ProjectAssignment,
  ProjectContractor,
  ProjectKeyMilestone,
  ProjectSapCode,
  ProjectEquipmentPlan,
  ProjectEquipmentQuota,
  ProjectHistoryEntry,
  ProjectManpowerPlanMonth,
  ProjectShiftRatio,
  ProjectStageWeight,
  ProjectWorkItem,
  SapQueueItem,
  Shift,
  Stage,
  UserAccount,
  ValueChainProgress,
} from '@/server/repo/types';
import { splitHeadcount } from '@/lib/shifts';
import { customers, exchangeRates, factories, teams, currencies } from './dims';
import {
  DAY_FACTORS, ERP_DETAIL_PROJECT_ID, contractors, equipmentLastDay, equipmentPlanSeed, equipmentQuotaSeed,
  equipments, keyMilestoneSeed, manpowerLastDay, manpowerPlanSeed, shiftRatioSeed, shifts, stages, workItemNames,
} from './erp';
import { seedProjects, type SeedProject } from './projects';

// Hằng số seed - CHỈ dùng để sinh dữ liệu mẫu. Code production đọc src/lib/clock.ts.
/** Kỳ báo cáo hiện tại (tháng 09/2026). */
export const SEED_VERSION = '2026-09-26-p3c-a';
export const SEED_REPORT_DATE = new Date('2026-09-16T00:00:00Z');
export const SEED_CURRENT_MONTH = '2026-09';
export const SEED_HISTORY_MONTHS = [
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
];

/** buildValueChain dùng phân số, còn LEGACY_STAGE_WEIGHTS là điểm phần trăm → chia 100.
 * Bỏ settlement (weightPct 0) - dữ liệu demo mô phỏng "dự án cũ", không sinh dòng chuỗi cho nó. */
const STAGE_WEIGHT_FRACTIONS = LEGACY_STAGE_WEIGHTS.filter((w) => w.weightPct > 0).map((w) => ({
  stage: w.stageCode,
  weight: w.weightPct / 100,
}));

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Tháng bắt đầu (index trong SEED_HISTORY_MONTHS) của 1 dự án, theo ngày BĐ thực tế. */
function startIndexOf(p: SeedProject): number {
  if (!p.actualStartDate) return 0;
  const ym = p.actualStartDate.slice(0, 7);
  const idx = SEED_HISTORY_MONTHS.indexOf(ym);
  if (idx >= 0) return idx;
  // Trước cửa sổ → 0; sau cửa sổ (chưa khởi công) → không có tiến độ
  return ym > SEED_HISTORY_MONTHS[SEED_HISTORY_MONTHS.length - 1] ? SEED_HISTORY_MONTHS.length : 0;
}

/** Sinh lịch sử tiến độ (S-curve) cho 1 dự án - 0 trước ngày BĐ thực tế. */
function monthlyProgress(p: SeedProject): number[] {
  const n = SEED_HISTORY_MONTHS.length;
  const s = startIndexOf(p);
  const span = n - s;
  const out: number[] = [];
  for (let m = 0; m < n; m++) {
    if (m < s) {
      out.push(0);
      continue;
    }
    const t = span <= 1 ? 1 : (m - s) / (span - 1);
    out.push(p.finalPctActual * smoothstep(t));
  }
  return out;
}

/** Chuỗi giá trị theo %TT hiện tại - monotonic, stage đầu tiên <100% = khâu nghẽn. */
function buildValueChain(pctActual: number, projectId: number, yearMonth: string): ValueChainProgress[] {
  let cumBefore = 0;
  const rows: ValueChainProgress[] = [];
  for (const { stage, weight } of STAGE_WEIGHT_FRACTIONS) {
    const pct = Math.max(0, Math.min(1, (pctActual - cumBefore) / weight));
    rows.push({ projectId, stageCode: stage, yearMonth, pctComplete: pct, applicable: true });
    cumBefore += weight;
  }
  return rows;
}

function toProject(p: SeedProject): Project {
  return {
    id: p.id,
    masterCode: p.masterCode,
    currentAliasCode: p.currentAliasCode,
    projectName: p.projectName,
    customerId: p.customerId,
    teamKdId: p.teamKdId,
    marketCode: p.marketCode,
    projectType: p.projectType,
    priority: p.priority,
    contractValue: p.contractValue,
    tonnage: p.tonnage,
    currencyCode: p.currencyCode,
    contractDate: p.contractDate,
    plannedStartDate: p.plannedStartDate,
    plannedFinishDate: p.plannedFinishDate,
    committedHandoverDate: p.committedHandoverDate,
    actualStartDate: p.actualStartDate,
    actualFinishDate: p.actualFinishDate,
    penaltyValue: p.penaltyValue,
    penalized: p.penalized,
    isActive: true,
    factoryId: (p.id % factories.length) + 1,
    contractValueOriginal: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    createdBy: 'system',
    updatedBy: 'system',
  };
}

function buildAlerts(projects: Project[], facts: FactProgressMonthly[]): AlertLog[] {
  const alerts: AlertLog[] = [];
  const latest = facts.filter((f) => f.yearMonth === SEED_CURRENT_MONTH);
  let id = 1;
  for (const proj of projects) {
    const f = latest.find((x) => x.projectId === proj.id);
    if (!f) continue;
    if (f.spi != null && f.spi < THRESHOLDS.spiWarn) {
      alerts.push({
        id: id++,
        projectId: proj.id,
        alertType: 'Amber',
        ruleTriggered: `SPI < ${THRESHOLDS.spiWarn}`,
        message: `SPI = ${f.spi.toFixed(2)} - trễ tiến độ theo giá trị`,
        openedAt: '2026-09-05T08:00:00Z',
        closedAt: null,
        owner: 'Trưởng phòng KHDATT',
        action: '',
        deadline: '2026-09-30',
        ruleCode: 'spi_low',
        dedupeKey: monthKey('spi_low', SEED_CURRENT_MONTH),
        closedBy: null,
        closeNote: '',
        notifyChannel: null,
        notifySentAt: null,
        notifyError: null,
        notifyAttempts: 0,
      });
    }
    if (f.cpi != null && f.cpi < THRESHOLDS.cpiWarn) {
      alerts.push({
        id: id++,
        projectId: proj.id,
        alertType: 'Amber',
        ruleTriggered: `CPI < ${THRESHOLDS.cpiWarn}`,
        message: `CPI = ${f.cpi.toFixed(2)} - vượt chi phí`,
        openedAt: '2026-09-05T08:00:00Z',
        closedAt: null,
        owner: 'Trưởng phòng KHDATT',
        action: '',
        deadline: '2026-09-30',
        ruleCode: 'cpi_low',
        dedupeKey: monthKey('cpi_low', SEED_CURRENT_MONTH),
        closedBy: null,
        closeNote: '',
        notifyChannel: null,
        notifySentAt: null,
        notifyError: null,
        notifyAttempts: 0,
      });
    }
    const pen = penaltyState({
      committedHandoverDate: proj.committedHandoverDate,
      pctActual: f.pctActual,
      penalized: proj.penalized,
      today: SEED_REPORT_DATE,
    });
    if (pen === 'penalized' || pen === 'risk') {
      const ruleCode = pen === 'penalized' ? 'penalty_overdue' : 'penalty_risk';
      alerts.push({
        id: id++,
        projectId: proj.id,
        alertType: 'Red',
        ruleTriggered: pen === 'penalized' ? 'Đã quá mốc cam kết' : 'Nguy cơ phạt HĐ (≤30 ngày)',
        message:
          pen === 'penalized'
            ? 'Đã quá ngày cam kết bàn giao, chưa nghiệm thu'
            : `Còn ≤30 ngày đến mốc bàn giao (${proj.committedHandoverDate}), %TT chưa đạt 100%`,
        openedAt: '2026-09-06T08:00:00Z',
        closedAt: null,
        owner: 'BOD',
        action: '',
        deadline: '2026-09-20',
        ruleCode,
        dedupeKey: handoverKey(ruleCode, proj.committedHandoverDate),
        closedBy: null,
        closeNote: '',
        notifyChannel: null,
        notifySentAt: null,
        notifyError: null,
        notifyAttempts: 0,
      });
    }
  }
  return alerts;
}

function buildAliases(projects: Project[]): ProjectAlias[] {
  const out: ProjectAlias[] = [];
  let id = 1;
  const oldCodes: Record<number, string> = { 5: '04-26/HĐTC-DDC NS', 10: '03-26/HĐTC-DDC NS' };
  for (const p of projects) {
    const old = oldCodes[p.id];
    if (old) {
      out.push({
        id: id++,
        projectId: p.id,
        aliasCode: old,
        aliasType: 'Ma_CT',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
        reason: 'Chuẩn hóa mã hợp đồng sang mã TCTN',
        approvedBy: 'Trưởng phòng KHDATT',
      });
    }
    out.push({
      id: id++,
      projectId: p.id,
      aliasCode: p.currentAliasCode,
      aliasType: 'Ma_noi_bo',
      effectiveFrom: old ? '2026-07-01' : '2026-01-01',
      effectiveTo: null,
      reason: 'Mã hiện hành',
      approvedBy: 'Trưởng phòng KHDATT',
    });
  }
  return out;
}

function buildSapCodes(projects: Project[]): ProjectSapCode[] {
  const out: ProjectSapCode[] = [];
  let id = 1;
  const demo: Record<number, string[]> = {
    11: ['SAP-EV-BSN-001'],
    16: ['SAP-MBS-001', 'SAP-MBS-002'],
  };
  for (const p of projects) {
    for (const code of demo[p.id] ?? []) {
      out.push({
        id: id++,
        projectId: p.id,
        sapCode: code,
        sourceDocType: 'Hợp đồng con',
        linkedAt: '2026-08-01T00:00:00Z',
        linkedBy: 'Trưởng phòng KHDATT',
        note: '',
      });
    }
  }
  return out;
}

/**
 * Phân quyền PIC từng dự án. Email PHẢI khớp userRoles bên dưới, nếu không
 * data-entry/viewer sẽ không đọc được dự án nào sau khi requireProjectRead có hiệu lực.
 */
function buildAssignments(projects: Project[]): ProjectAssignment[] {
  const pmOwns = new Set([1, 2, 3, 5, 7, 11]);       // pm@daidung.com.vn là PIC
  const viewerSees = new Set([1, 2, 4, 6, 8, 10]);   // viewer@ được gán Backup để có quyền đọc
  const out: ProjectAssignment[] = [];
  for (const p of projects) {
    out.push({
      projectId: p.id,
      userEmail: pmOwns.has(p.id) ? 'pm@daidung.com.vn' : 'admin@daidung.com.vn',
      roleInProject: 'PIC',
      assignedBy: 'Trưởng phòng KHDATT',
      assignedAt: '2026-01-01T00:00:00Z',
    });
    if (viewerSees.has(p.id)) {
      out.push({
        projectId: p.id,
        userEmail: 'viewer@daidung.com.vn',
        roleInProject: 'Backup',
        assignedBy: 'Trưởng phòng KHDATT',
        assignedAt: '2026-01-01T00:00:00Z',
      });
    }
  }
  return out;
}

/** Mọi dự án nhận trọng số "dự án cũ" (5/10/10/40/5/27/3 + Thanh quyết toán 0) - đúng tình trạng
 * DB thật sau migration P7-C2 (K6, K7). */
function buildStageWeights(projects: Project[]): ProjectStageWeight[] {
  return projects.flatMap((p) =>
    LEGACY_STAGE_WEIGHTS.map((w) => ({
      projectId: p.id,
      stageCode: w.stageCode,
      weightPct: w.weightPct,
      applicable: w.applicable,
    })),
  );
}

/** 7 mốc giai đoạn cho mọi dự án (không sinh mốc cho Thanh quyết toán): chia đều khoảng KH bắt
 * đầu → KH kết thúc theo trọng số lũy kế. */
function buildStageMilestones(projects: Project[]): FactStageMilestone[] {
  const out: FactStageMilestone[] = [];
  const milestoneStages = LEGACY_STAGE_WEIGHTS.filter((w) => w.weightPct > 0);
  for (const p of projects) {
    if (!p.plannedStartDate || !p.plannedFinishDate) continue;
    const t0 = new Date(p.plannedStartDate).getTime();
    const span = new Date(p.plannedFinishDate).getTime() - t0;
    let cum = 0;
    for (const w of milestoneStages) {
      const from = cum / 100;
      cum += w.weightPct;
      const to = cum / 100;
      const start = new Date(t0 + span * from).toISOString().slice(0, 10);
      const finish = new Date(t0 + span * to).toISOString().slice(0, 10);
      const done = p.actualStartDate != null && to <= 0.5; // demo: nửa đầu chuỗi coi như đã xong
      out.push({
        projectId: p.id,
        stageCode: w.stageCode,
        plannedStart: start,
        plannedFinish: finish,
        actualStart: p.actualStartDate ? start : null,
        actualFinish: done ? finish : null,
        forecastDate: done ? null : finish,
        updatedAt: '2026-09-02T00:00:00Z',
        updatedBy: 'system',
      });
    }
  }
  return out;
}

/** 10 hạng mục + sản lượng KH/TT theo từng giai đoạn - chỉ cho dự án chi tiết. */
function buildWorkItems(projects: Project[]): {
  workItems: ProjectWorkItem[];
  facts: FactStageWorkItem[];
} {
  const p = projects.find((x) => x.id === ERP_DETAIL_PROJECT_ID);
  if (!p) return { workItems: [], facts: [] };

  const workItems: ProjectWorkItem[] = workItemNames.map((name, i) => ({
    id: i + 1,
    projectId: p.id,
    name,
    sortOrder: i + 1,
  }));

  // Chia tấn của dự án cho 10 hạng mục theo tỷ trọng giảm dần, tổng = p.tonnage.
  const shares = [0.18, 0.15, 0.13, 0.12, 0.1, 0.09, 0.07, 0.06, 0.055, 0.045];
  const volumeStages = stages.filter((s) => s.calcMode === 'volume').map((s) => s.code);

  const facts: FactStageWorkItem[] = [];
  for (const wi of workItems) {
    const itemTon = Math.round(p.tonnage * shares[wi.sortOrder - 1]);
    for (const stageCode of volumeStages) {
      // %TT giai đoạn giảm dần theo thứ tự chuỗi giá trị (Shop xong nhiều hơn Lắp dựng).
      const idx = SEED_STAGE_CODES.indexOf(stageCode as (typeof SEED_STAGE_CODES)[number]);
      const ratio = Math.max(0, Math.min(1, 1.15 - idx * 0.12));
      facts.push({
        projectId: p.id,
        stageCode,
        workItemId: wi.id,
        yearMonth: SEED_CURRENT_MONTH,
        qtyPlan: itemTon,
        qtyActual: Math.round(itemTon * ratio),
      });
    }
  }
  return { workItems, facts };
}

function buildKeyMilestones(): ProjectKeyMilestone[] {
  return keyMilestoneSeed.map((m, i) => ({
    id: i + 1,
    projectId: ERP_DETAIL_PROJECT_ID,
    name: m.name,
    sortOrder: i + 1,
    plannedDate: m.plannedDate,
    actualDate: m.actualDate,
  }));
}

/** 7 ngày tracking gần nhất tính lùi từ SEED_REPORT_DATE (ngày cuối = SEED_REPORT_DATE). */
function trackingDates(): string[] {
  const end = SEED_REPORT_DATE.getTime();
  return DAY_FACTORS.map((_, i) =>
    new Date(end - (DAY_FACTORS.length - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

function buildDailyResources(): {
  projectContractors: ProjectContractor[];
  manpowerShifts: FactDailyManpowerShift[];
  equipmentUsage: FactDailyEquipmentUsage[];
} {
  const pid = ERP_DETAIL_PROJECT_ID;
  const dates = trackingDates();

  const projectContractors: ProjectContractor[] = contractors.map((c) => ({
    projectId: pid,
    contractorId: c.id,
  }));

  const manpowerShifts: FactDailyManpowerShift[] = [];
  const equipmentUsage: FactDailyEquipmentUsage[] = [];

  dates.forEach((workDate, d) => {
    const f = DAY_FACTORS[d];
    for (const row of manpowerLastDay) {
      const total = Math.round(row.planned * f);
      const totalActual = Math.round(row.actual * f);
      const [morningPlanned, eveningPlanned] = splitHeadcount(total);
      const [morningActual, eveningActual] = splitHeadcount(totalActual);
      manpowerShifts.push({
        projectId: pid,
        contractorId: row.contractorId,
        workDate,
        shiftCode: 'morning',
        plannedHeadcount: morningPlanned,
        actualHeadcount: morningActual,
      });
      manpowerShifts.push({
        projectId: pid,
        contractorId: row.contractorId,
        workDate,
        shiftCode: 'evening',
        plannedHeadcount: eveningPlanned,
        actualHeadcount: eveningActual,
      });
    }
    for (const row of equipmentLastDay) {
      equipmentUsage.push({
        projectId: pid,
        contractorId: row.contractorId,
        equipmentId: row.equipmentId,
        workDate,
        qtyPlanned: Math.round(row.planned * f),
        qtyActual: Math.round(row.actual * f),
      });
    }
  });

  return { projectContractors, manpowerShifts, equipmentUsage };
}

/**
 * % KH theo thời gian của MỘT tháng = mốc ngày cuối tháng đó.
 * Export ra để history.test.ts kiểm PV bằng đúng công thức này, không chép lại số.
 * Hàm thuần - endOfMonth không đọc đồng hồ nên seed vẫn deterministic.
 */
export function seedPctPlanDuration(p: SeedProject, yearMonth: string): number {
  const at = new Date(`${endOfMonth(yearMonth)}T00:00:00Z`);
  return calcDurationPctComplete(p.plannedStartDate, p.plannedFinishDate, at) ?? 0;
}

export interface RepoData {
  projects: Project[];
  facts: FactProgressMonthly[];
  valueChain: ValueChainProgress[];
  financial: FactFinancial[];
  volumes: FactVolume[];
  alerts: AlertLog[];
  aliases: ProjectAlias[];
  sapCodes: ProjectSapCode[];
  assignments: ProjectAssignment[];
  projectHistory: ProjectHistoryEntry[];
  auditLog: AuditLogEntry[];
  sapQueue: SapQueueItem[];
  userRoles: UserAccount[];
  activityLog: ActivityLogEntry[];
  customers: typeof customers;
  teams: typeof teams;
  factories: typeof factories;
  currencies: typeof currencies;
  exchangeRates: typeof exchangeRates;
  stages: Stage[];
  stageWeights: ProjectStageWeight[];
  workItems: ProjectWorkItem[];
  workItemFacts: FactStageWorkItem[];
  stageMilestones: FactStageMilestone[];
  keyMilestones: ProjectKeyMilestone[];
  contractors: Contractor[];
  projectContractors: ProjectContractor[];
  equipments: Equipment[];
  shifts: Shift[];
  dailyManpowerShifts: FactDailyManpowerShift[];
  dailyEquipment: FactDailyEquipmentUsage[];
  equipmentPlans: ProjectEquipmentPlan[];
  equipmentQuotas: ProjectEquipmentQuota[];
  manpowerPlanMonths: ProjectManpowerPlanMonth[];
  shiftRatios: ProjectShiftRatio[];
  jobRuns: JobRunEntry[];
}

export function buildRepoData(): RepoData {
  const projects = seedProjects.map(toProject);
  const projectFactoryId = new Map(projects.map((p) => [p.id, p.factoryId!]));
  const facts: FactProgressMonthly[] = [];
  const valueChain: ValueChainProgress[] = [];
  const financial: FactFinancial[] = [];
  const volumes: FactVolume[] = [];

  for (const p of seedProjects) {
    const bac = p.contractValue;
    const progress = monthlyProgress(p);
    const startIdx = startIndexOf(p);
    const nMonths = SEED_HISTORY_MONTHS.length;
    let prevEv = 0;
    let prevAc = 0;

    for (let m = 0; m < nMonths; m++) {
      const yearMonth = SEED_HISTORY_MONTHS[m];
      const pctActual = progress[m];
      const span = nMonths - startIdx;
      const tPlan = m < startIdx ? 0 : span <= 1 ? 1 : (m - startIdx) / (span - 1);
      const pctPlan = p.finalPctPlan * tPlan;              // số nhập tay, KHÔNG dùng để tính PV nữa
      const pv = seedPctPlanDuration(p, yearMonth) * bac;
      const ev = pctActual * bac;
      // CPI giả định không đổi theo tháng (= finalCpi); AC = EV / CPI (khớp dữ liệu thật)
      const acVal = p.finalCpi ? ev / p.finalCpi : 0;
      const spi = calcSpi(ev, pv);
      const cpi = acVal ? ev / acVal : null;

      facts.push({
        projectId: p.id,
        yearMonth,
        pctPlan,
        pctActual,
        actualStartDate: p.actualStartDate,
        actualFinishDate: p.actualFinishDate,
        bac,
        pv,
        ev,
        ac: acVal,
        spi,
        cpi,
        bottleneckStage: null,
        isLatest: true,
        manpowerPlanned: p.id === ERP_DETAIL_PROJECT_ID ? 520 : 0,
        manpowerActual: p.id === ERP_DETAIL_PROJECT_ID ? 486 : 0,
        equipmentPlanned: p.id === ERP_DETAIL_PROJECT_ID ? 72 : 10,
        equipmentActual: p.id === ERP_DETAIL_PROJECT_ID ? 63 : Math.round(10 * (pctActual > 0 ? 0.7 + 0.3 * (pctActual / p.finalPctActual || 0) : 0)),
        snapshotLockedAt: m < SEED_HISTORY_MONTHS.length - 1 ? '2026-09-02T00:00:00Z' : null,
        lockedBy: m < SEED_HISTORY_MONTHS.length - 1 ? 'Trưởng phòng KHDATT' : null,
        version: 1,
        changedBy: 'system',
        changedAt: '2026-09-02T00:00:00Z',
        changeNote: '',
      });

      const revenueCum = ev;
      const costCum = acVal;
      const arOverdue = p.penalized ? Math.round(bac * 0.06 * 10) / 10 : 0;
      const arCollected = Math.round(ev * 0.75 * 10) / 10;
      financial.push({
        projectId: p.id,
        yearMonth,
        revenuePeriod: Math.round((ev - prevEv) * 10) / 10,
        revenueCumulative: revenueCum,
        costActualPeriod: Math.round((acVal - prevAc) * 10) / 10,
        costActualCumulative: costCum,
        grossProfit: Math.round((revenueCum - costCum) * 10) / 10,
        grossMarginPct: revenueCum ? (revenueCum - costCum) / revenueCum : 0,
        backlog: p.finalPctActual === 0 ? bac : 0,
        arCollected,
        arOutstanding: Math.round(Math.max(0, ev - arCollected - arOverdue) * 10) / 10,
        arOverdue,
        version: 1,
        isLatest: true,
        changedBy: 'system',
        changedAt: '2026-09-02T00:00:00Z',
        changeNote: '',
      });

      const tonnageThisMonth =
        m === 0 ? p.tonnage * pctActual : p.tonnage * (pctActual - progress[m - 1]);
      volumes.push({
        projectId: p.id,
        yearMonth,
        factoryId: projectFactoryId.get(p.id)!,
        tonnageProcessed: Math.round(tonnageThisMonth),
      });

      prevEv = ev;
      prevAc = acVal;
    }

    // Chuỗi giá trị + khâu nghẽn cho tháng hiện tại
    const chain = buildValueChain(p.finalPctActual, p.id, SEED_CURRENT_MONTH);
    valueChain.push(...chain);
    const bottleneck = findBottleneck(chain, SEED_STAGE_CODES, LEGACY_STAGE_WEIGHTS);
    const latest = facts.filter((f) => f.projectId === p.id && f.yearMonth === SEED_CURRENT_MONTH);
    if (latest.length) latest[latest.length - 1].bottleneckStage = bottleneck;
  }

  const wi = buildWorkItems(projects);
  const res = buildDailyResources();

  return {
    projects,
    facts,
    valueChain,
    financial,
    volumes,
    alerts: buildAlerts(projects, facts),
    aliases: buildAliases(projects),
    sapCodes: buildSapCodes(projects),
    assignments: buildAssignments(projects),
    projectHistory: [],
    auditLog: [],
    sapQueue: [],
    userRoles: [
      { email: 'admin@daidung.com.vn', name: 'Admin', passwordHash: hashSync('Admin@123', 10), role: 'admin', canViewFinance: true, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null, lockedAt: null },
      { email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: hashSync('Bod@12345', 10), role: 'bod', canViewFinance: true, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null, lockedAt: null },
      { email: 'pm@daidung.com.vn', name: 'PM', passwordHash: hashSync('Pm@12345', 10), role: 'data-entry', canViewFinance: true, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null, lockedAt: null },
      { email: 'viewer@daidung.com.vn', name: 'Viewer', passwordHash: hashSync('Viewer@12345', 10), role: 'viewer', canViewFinance: false, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null, lockedAt: null },
    ],
    activityLog: [],
    customers,
    teams,
    // Sao chép để repo.reset() khôi phục được sau khi admin sửa (mảng seed dùng chung giữa các lần dựng).
    factories: factories.map((f) => ({ ...f })),
    currencies,
    exchangeRates,
    stages: stages.map((s) => ({ ...s })),
    stageWeights: buildStageWeights(projects),
    workItems: wi.workItems,
    workItemFacts: wi.facts,
    stageMilestones: buildStageMilestones(projects),
    keyMilestones: buildKeyMilestones(),
    contractors,
    projectContractors: res.projectContractors,
    equipments,
    shifts,
    dailyManpowerShifts: res.manpowerShifts,
    dailyEquipment: res.equipmentUsage,
    equipmentPlans: equipmentPlanSeed,
    equipmentQuotas: equipmentQuotaSeed,
    manpowerPlanMonths: manpowerPlanSeed,
    shiftRatios: shiftRatioSeed,
    jobRuns: [],
  };
}
