import { findBottleneck, penaltyState } from '@/lib/evm';
import { THRESHOLDS } from '@/lib/thresholds';
import { hashSync } from 'bcryptjs';
import type {
  ActivityLogEntry,
  AlertLog,
  AuditLogEntry,
  FactFinancial,
  FactProgressMonthly,
  FactVolume,
  Project,
  ProjectAlias,
  ProjectAssignment,
  ProjectSapCode,
  ProjectPhoto,
  ProjectHistoryEntry,
  SapQueueItem,
  StageCode,
  UserAccount,
  ValueChainProgress,
} from '@/server/repo/types';
import { customers, exchangeRates, factories, teams, currencies } from './dims';
import { seedProjects, type SeedProject } from './projects';

// Hằng số seed - CHỈ dùng để sinh dữ liệu mẫu. Code production đọc src/lib/clock.ts.
/** Kỳ báo cáo hiện tại (tháng 09/2026). */
export const SEED_VERSION = '2026-09-22-erp-v2';
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

const STAGE_WEIGHTS: { stage: StageCode; weight: number }[] = [
  { stage: 'design', weight: 0.06 },
  { stage: 'shop', weight: 0.12 },
  { stage: 'procurement', weight: 0.1 },
  { stage: 'fabrication', weight: 0.34 },
  { stage: 'transport', weight: 0.05 },
  { stage: 'erection', weight: 0.28 },
  { stage: 'handover', weight: 0.05 },
];

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
  for (const { stage, weight } of STAGE_WEIGHTS) {
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
      });
    }
    const pen = penaltyState({
      committedHandoverDate: proj.committedHandoverDate,
      pctActual: f.pctActual,
      penalized: proj.penalized,
      today: SEED_REPORT_DATE,
    });
    if (pen === 'penalized' || pen === 'risk') {
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

function buildPhotos(projects: Project[]): ProjectPhoto[] {
  return projects.slice(0, 4).map((p, i) => ({
    id: i + 1,
    projectId: p.id,
    yearMonth: SEED_CURRENT_MONTH,
    url: '',
    caption: 'Ảnh hiện trường tháng 09/2026',
    uploadedBy: 'PM dự án',
    uploadedAt: '2026-09-10T00:00:00Z',
  }));
}

/**
 * Phân quyền PIC từng dự án (project_assignments) - mock.
 * Data-entry (dev@localhost) chỉ thấy các dự án mình là PIC.
 */
function buildAssignments(projects: Project[]): ProjectAssignment[] {
  const devOwns = new Set([1, 2, 3, 5, 7, 11]);
  const pm1Owns = new Set([4, 6, 8, 9, 10]);
  return projects.map((p) => ({
    projectId: p.id,
    userEmail: devOwns.has(p.id) ? 'dev@localhost' : pm1Owns.has(p.id) ? 'pm1@daidung.com.vn' : 'pm2@daidung.com.vn',
    roleInProject: 'PIC' as const,
    assignedBy: 'Trưởng phòng KHDATT',
    assignedAt: '2026-01-01T00:00:00Z',
  }));
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
  photos: ProjectPhoto[];
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
}

export function buildRepoData(): RepoData {
  const projects = seedProjects.map(toProject);
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
      const pctPlan = p.finalPctPlan * tPlan;
      const pv = pctPlan * bac;
      const ev = pctActual * bac;
      // CPI giả định không đổi theo tháng (= finalCpi); AC = EV / CPI (khớp dữ liệu thật)
      const acVal = p.finalCpi ? ev / p.finalCpi : 0;
      const spi = pv ? ev / pv : null;
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
        equipmentPlanned: 10,
        equipmentActual: Math.round(10 * (pctActual > 0 ? 0.7 + 0.3 * (pctActual / p.finalPctActual || 0) : 0)),
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
        changedBy: 'system',
        changedAt: '2026-09-02T00:00:00Z',
        changeNote: '',
      });

      const tonnageThisMonth =
        m === 0 ? p.tonnage * pctActual : p.tonnage * (pctActual - progress[m - 1]);
      volumes.push({
        projectId: p.id,
        yearMonth,
        factoryId: (p.id % factories.length) + 1,
        tonnageProcessed: Math.round(tonnageThisMonth),
      });

      prevEv = ev;
      prevAc = acVal;
    }

    // Chuỗi giá trị + khâu nghẽn cho tháng hiện tại
    const chain = buildValueChain(p.finalPctActual, p.id, SEED_CURRENT_MONTH);
    valueChain.push(...chain);
    const bottleneck = findBottleneck(chain);
    const latest = facts.filter((f) => f.projectId === p.id && f.yearMonth === SEED_CURRENT_MONTH);
    if (latest.length) latest[latest.length - 1].bottleneckStage = bottleneck;
  }

  return {
    projects,
    facts,
    valueChain,
    financial,
    volumes,
    alerts: buildAlerts(projects, facts),
    aliases: buildAliases(projects),
    sapCodes: buildSapCodes(projects),
    photos: buildPhotos(projects),
    assignments: buildAssignments(projects),
    projectHistory: [],
    auditLog: [],
    sapQueue: [],
    userRoles: [
      { email: 'admin@daidung.com.vn', name: 'Admin', passwordHash: hashSync('Admin@123', 10), role: 'admin', canViewFinance: true, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null },
      { email: 'bod@daidung.com.vn', name: 'BOD', passwordHash: hashSync('Bod@12345', 10), role: 'bod', canViewFinance: true, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null },
      { email: 'pm@daidung.com.vn', name: 'PM', passwordHash: hashSync('Pm@12345', 10), role: 'data-entry', canViewFinance: true, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null },
      { email: 'viewer@daidung.com.vn', name: 'Viewer', passwordHash: hashSync('Viewer@12345', 10), role: 'viewer', canViewFinance: false, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null },
    ],
    activityLog: [],
    customers,
    teams,
    factories,
    currencies,
    exchangeRates,
  };
}
