import { buildRepoData, SEED_VERSION, type RepoData } from '@/data/seed/history';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_STAGE_WEIGHTS, isSameStageSet, StagesChangedError, type StageInput } from '@/lib/stages';
import { calcDayVariance, calcDurationPctComplete, calcSpi } from '@/lib/evm';
import { endOfMonth, todayIso } from '@/lib/clock';
import { keyMsAuditText } from '@/lib/key-milestones';
import { sumManpowerShifts } from '@/lib/shifts';
import { ProjectCodeTakenError } from '@/lib/project-code';
import { createReadMock } from './read-mock';
import { makeEntryMockRepo } from './mock-repo-entry';
import { isProjectCodeTakenIn, makeFormMockRepo, replaceStageWeightsIn } from './mock-repo-form';
import { makeBackfillMockRepo, resetBackfillMock } from './mock-repo-backfill';
import { makeNotifyMockRepo, resetNotifyMock } from './mock-repo-notify';
import type {
  ActivityLogEntry,
  AlertLog,
  AuditLogEntry,
  Contractor,
  CreateProjectInput,
  CurrencyCode,
  Customer,
  Equipment,
  FactDailyEquipmentUsage,
  FactDailyManpower,
  FactProgressMonthly,
  FactFinancial,
  FactStageWorkItem,
  FactVolume,
  Market,
  Priority,
  Project,
  ProjectAlias,
  ProjectAssignment,
  ProjectContractor,
  ProjectHistoryEntry,
  ProjectKeyMilestone,
  KeyMilestoneInput,
  ProjectSapCode,
  ProjectStageWeight,
  ProjectType,
  ProjectWorkItem,
  Role,
  SapQueueItem,
  SaveFactResult,
  Stage,
  StageCode,
  StageMilestoneView,
  TeamKd,
  UserAccount,
  ValueChainProgress,
} from './types';

/**
 * Repository in-memory (mock). Đổi sang Supabase/Prisma sau: viết 1 impl khác
 * cùng signature, không đổi tầng trên.
 *
 * LƯU Ý: data lưu trên `globalThis` - Next.js bundle server component / server
 * action / route handler thành các chunk riêng; nếu để module-level, mỗi chunk
 * có 1 bản copy riêng → ghi (action) không thấy ở đọc (route/login). globalThis
 * chia sẻ 1 nguồn duy nhất.
 */
const globalForData = globalThis as unknown as { __ddcRepoData?: RepoData };

// Persistence tạm (đến khi Supabase/Prisma): lưu JSON ra disk để mutation
// (đổi pass, tạo account, merge dim, fact...) không mất khi restart dev server.
const PERSIST_FILE = join(process.cwd(), '.data', 'ddc-mock.json');
const PERSIST_ENABLED = process.env.NODE_ENV !== 'test';

function loadPersisted(): RepoData | null {
  if (!PERSIST_ENABLED) return null;
  try {
    if (!existsSync(PERSIST_FILE)) return null;
    const parsed = JSON.parse(readFileSync(PERSIST_FILE, 'utf-8')) as {
      __seedVersion?: string;
      data?: RepoData;
    };
    if (parsed.__seedVersion !== SEED_VERSION || !parsed.data) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function persist() {
  if (!PERSIST_ENABLED) return;
  try {
    mkdirSync(join(process.cwd(), '.data'), { recursive: true });
    writeFileSync(PERSIST_FILE, JSON.stringify({ __seedVersion: SEED_VERSION, data: getData() }));
  } catch {
    /* read-only FS (Vercel) hoặc lỗi ghi → bỏ qua, vẫn chạy in-memory */
  }
}

function getData(): RepoData {
  if (!globalForData.__ddcRepoData) {
    globalForData.__ddcRepoData = loadPersisted() ?? buildRepoData();
  }
  return globalForData.__ddcRepoData;
}

const coreRepo = {
  reset() {
    resetNotifyMock();
    resetBackfillMock();
    delete globalForData.__ddcRepoData;
    if (PERSIST_ENABLED) {
      try {
        rmSync(PERSIST_FILE, { force: true });
      } catch {
        /* ignore */
      }
    }
  },

  // ---- Reads ----
  listProjects(): Project[] {
    return getData().projects.filter((p) => p.isActive);
  },

  getProject(id: number): Project | undefined {
    return getData().projects.find((p) => p.id === id && p.isActive);
  },

  /** Fact bất biến (append-only): trả về bản isLatest mỗi (projectId, yearMonth). */
  _latestFacts(): FactProgressMonthly[] {
    return getData().facts.filter((f) => f.isLatest);
  },

  _latestFinancial(): FactFinancial[] {
    return getData().financial.filter((f) => f.isLatest);
  },

  getFacts(projectId: number): FactProgressMonthly[] {
    return this._latestFacts()
      .filter((f) => f.projectId === projectId)
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  },

  getLatestFact(projectId: number, yearMonth: string): FactProgressMonthly | undefined {
    if (yearMonth === 'all') {
      return this._latestFacts()
        .filter((f) => f.projectId === projectId)
        .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0];
    }
    return this._latestFacts().find((f) => f.projectId === projectId && f.yearMonth === yearMonth);
  },

  getFactsForMonth(yearMonth: string): FactProgressMonthly[] {
    const facts = this._latestFacts();
    if (yearMonth === 'all') {
      const map = new Map<number, FactProgressMonthly>();
      for (const f of facts) {
        const cur = map.get(f.projectId);
        if (!cur || f.yearMonth > cur.yearMonth) map.set(f.projectId, f);
      }
      return [...map.values()];
    }
    return facts.filter((f) => f.yearMonth === yearMonth);
  },

  getValueChain(projectId: number, yearMonth: string): ValueChainProgress[] {
    return getData().valueChain.filter((v) => v.projectId === projectId && v.yearMonth === yearMonth);
  },

  // ---- ERP v2 ----
  getStages(): Stage[] {
    return [...getData().stages].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /** Không có dòng nào cho dự án → rơi về bộ trọng số mặc định (không trả mảng rỗng). */
  getStageWeights(projectId: number): ProjectStageWeight[] {
    const rows = getData().stageWeights.filter((w) => w.projectId === projectId);
    return rows.length
      ? rows
      : DEFAULT_STAGE_WEIGHTS.map((w) => ({ projectId, stageCode: w.stageCode, weightPct: w.weightPct, applicable: w.applicable }));
  },

  getWorkItems(projectId: number): ProjectWorkItem[] {
    return getData().workItems
      .filter((w) => w.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  getWorkItemFacts(projectId: number, yearMonth: string, stageCode?: StageCode): FactStageWorkItem[] {
    return getData().workItemFacts.filter(
      (f) => f.projectId === projectId && f.yearMonth === yearMonth && (!stageCode || f.stageCode === stageCode),
    );
  },

  /** Trả StageMilestoneView: 5 cột DB + "Ngày chênh lệch" tính runtime (Q1). */
  getStageMilestones(projectId: number): StageMilestoneView[] {
    return getData().stageMilestones
      .filter((m) => m.projectId === projectId)
      .map((m) => ({ ...m, dayVariance: calcDayVariance(m.plannedFinish, m.actualFinish) }));
  },

  getKeyMilestones(projectId: number): ProjectKeyMilestone[] {
    return getData().keyMilestones
      .filter((m) => m.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  getContractors(projectId?: number): Contractor[] {
    const all = getData().contractors.filter((c) => c.isActive);
    if (projectId == null) return all;
    const ids = new Set(
      getData().projectContractors.filter((pc) => pc.projectId === projectId).map((pc) => pc.contractorId),
    );
    return all.filter((c) => ids.has(c.id));
  },

  getEquipments(): Equipment[] {
    return getData().equipments.filter((e) => e.isActive);
  },

  /** from/to là 'YYYY-MM-DD', bao gồm cả hai đầu. */
  getDailyManpower(projectId: number, from: string, to: string): FactDailyManpower[] {
    const rows = getData().dailyManpowerShifts
      .filter((m) => m.projectId === projectId && m.workDate >= from && m.workDate <= to);
    return sumManpowerShifts(rows);
  },

  getDailyEquipment(projectId: number, from: string, to: string): FactDailyEquipmentUsage[] {
    return getData().dailyEquipment
      .filter((e) => e.projectId === projectId && e.workDate >= from && e.workDate <= to)
      .sort((a, b) => a.workDate.localeCompare(b.workDate));
  },

  getFinancial(projectId: number): FactFinancial[] {
    return this._latestFinancial()
      .filter((f) => f.projectId === projectId)
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  },

  getFinancialForMonth(yearMonth: string): FactFinancial[] {
    const fin = this._latestFinancial();
    if (yearMonth === 'all') {
      const map = new Map<number, FactFinancial>();
      for (const f of fin) {
        const cur = map.get(f.projectId);
        if (!cur || f.yearMonth > cur.yearMonth) map.set(f.projectId, f);
      }
      return [...map.values()];
    }
    return fin.filter((f) => f.yearMonth === yearMonth);
  },

  getVolumesForMonth(yearMonth: string): FactVolume[] {
    const vols = getData().volumes;
    if (yearMonth === 'all') {
      const map = new Map<string, FactVolume>();
      for (const v of vols) {
        const k = `${v.projectId}|${v.factoryId}`;
        const cur = map.get(k);
        if (!cur || v.yearMonth > cur.yearMonth) map.set(k, v);
      }
      return [...map.values()];
    }
    return vols.filter((v) => v.yearMonth === yearMonth);
  },

  getAlerts(projectId?: number): AlertLog[] {
    const all = getData().alerts;
    return (projectId ? all.filter((a) => a.projectId === projectId) : all).sort((a, b) =>
      b.openedAt.localeCompare(a.openedAt),
    );
  },

  getAliases(projectId: number): ProjectAlias[] {
    return getData()
      .aliases.filter((a) => a.projectId === projectId)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  },

  getSapCodes(projectId?: number): ProjectSapCode[] {
    return projectId ? getData().sapCodes.filter((s) => s.projectId === projectId) : getData().sapCodes;
  },

  getDims() {
    const d = getData();
    return {
      customers: d.customers.filter((x) => x.isActive),
      teams: d.teams.filter((x) => x.isActive),
      factories: d.factories,
      currencies: d.currencies,
      exchangeRates: d.exchangeRates,
    };
  },

  // ---- RBAC: project_assignments ----
  getAssignmentsForUser(email: string): number[] {
    return getData()
      .assignments.filter((a) => a.userEmail === email)
      .map((a) => a.projectId);
  },

  getAssignments(): ProjectAssignment[] {
    return getData().assignments;
  },

  // ---- Dim chuẩn hóa (customer / team): autocomplete + merge + rename ----
  _dimList(field: 'customer' | 'team'): (Customer | TeamKd)[] {
    const d = getData();
    return field === 'customer' ? d.customers : d.teams;
  },

  suggestDim(field: 'customer' | 'team', query: string): { id: number; name: string }[] {
    const list = this._dimList(field);
    const q = query.toLowerCase().trim();
    if (!q) return list.filter((x) => x.isActive).map((x) => ({ id: x.id, name: x.name }));
    return list
      .filter(
        (x) =>
          x.isActive &&
          (x.name.toLowerCase().includes(q) || x.aliases.some((a) => a.toLowerCase().includes(q))),
      )
      .map((x) => ({ id: x.id, name: x.name }));
  },

  /** Tạo dim mới nếu chưa có (match name hoặc alias). Trả về id. */
  createDimValue(field: 'customer' | 'team', name: string, opts?: { needsReview?: boolean; by?: string }): number {
    const list = this._dimList(field);
    const n = name.trim();
    const existing = list.find(
      (x) => x.name.toLowerCase() === n.toLowerCase() || x.aliases.some((a) => a.toLowerCase() === n.toLowerCase()),
    );
    if (existing) return existing.id;
    const id = list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    if (field === 'customer') {
      (list as Customer[]).push({
        id, name: n, group: 'Khác', aliases: [], isActive: true, mergedIntoId: null,
        needsReview: opts?.needsReview ?? false, createdBy: opts?.by ?? 'system',
      });
    } else {
      (list as TeamKd[]).push({ id, name: n, picName: '-', aliases: [], isActive: true, mergedIntoId: null });
    }
    return id;
  },

  renameDimValue(field: 'customer' | 'team', id: number, newName: string) {
    const x = this._dimList(field).find((v) => v.id === id);
    if (!x || x.name === newName) return;
    if (!x.aliases.includes(x.name)) x.aliases.push(x.name); // giữ tên cũ làm alias
    x.name = newName;
  },

  /** Merge dim A→B: re-point mọi project FK, mark A inactive. Trả về số project đã đổi. */
  mergeDimValue(field: 'customer' | 'team', fromId: number, toId: number): number {
    const d = getData();
    const from = this._dimList(field).find((v) => v.id === fromId);
    const to = this._dimList(field).find((v) => v.id === toId);
    if (!from || !to || fromId === toId) return 0;
    let n = 0;
    if (field === 'customer') {
      for (const p of d.projects) if (p.customerId === fromId) { p.customerId = toId; n++; }
    } else {
      for (const p of d.projects) if (p.teamKdId === fromId) { p.teamKdId = toId; n++; }
    }
    if (!to.aliases.includes(from.name)) to.aliases.push(from.name);
    for (const a of from.aliases) if (!to.aliases.includes(a)) to.aliases.push(a);
    from.isActive = false;
    from.mergedIntoId = toId;
    if (field === 'customer') (from as Customer).needsReview = false;
    return n;
  },

  getDimFieldValues(field: 'customer' | 'team') {
    const d = getData();
    return this._dimList(field).map((x) => ({
      id: x.id,
      name: x.name,
      isActive: x.isActive,
      mergedIntoId: x.mergedIntoId,
      needsReview: field === 'customer' ? (x as Customer).needsReview : false,
      refCount: d.projects.filter((p) => (field === 'customer' ? p.customerId : p.teamKdId) === x.id).length,
    }));
  },

  getProjectHistory(): ProjectHistoryEntry[] {
    return [...getData().projectHistory].sort((a, b) => b.at.localeCompare(a.at));
  },

  // ---- User accounts (email + password + quyền) ----
  getUserRoles(): UserAccount[] {
    return [...getData().userRoles].sort((a, b) => a.email.localeCompare(b.email));
  },

  findAccount(email: string): UserAccount | undefined {
    return getData().userRoles.find((u) => u.email === email.toLowerCase());
  },

  createAccount(account: UserAccount) {
    getData().userRoles.push(account);
  },

  setUserRole(email: string, role: Role, _canViewFinanceHint: boolean, changedBy = 'system') {
    const u = this.findAccount(email);
    if (!u) return;
    // T-2 (danh-gia-bao-mat.md): tham số `_canViewFinanceHint` do caller (actions.ts) truyền bị BỎ QUA
    // có chủ đích - đổi role không được âm thầm ghi đè canViewFinance Q6 đã đặt riêng cho từng người.
    // viewer -> luôn tắt; data-entry -> luôn bật (T-1, nay là quyết định lâu dài QĐ-10); vai
    // trò khác -> giữ nguyên giá trị hiện có.
    const prev = u.canViewFinance;
    const next = role === 'viewer' ? false : role === 'data-entry' ? true : prev;
    u.role = role;
    if (next !== prev) {
      this.logAudit('user_roles', u.email, 'canViewFinance', String(prev), String(next), changedBy);
      u.canViewFinance = next;
    }
  },

  removeUserRole(email: string) {
    const d = getData();
    d.userRoles = d.userRoles.filter((u) => u.email !== email);
  },

  removeProject(id: number) {
    const d = getData();
    const proj = d.projects.find((x) => x.id === id);
    if (!proj) return;
    // cascade: xóa mọi data con theo project
    d.projects = d.projects.filter((x) => x.id !== id);
    d.facts = d.facts.filter((x) => x.projectId !== id);
    d.financial = d.financial.filter((x) => x.projectId !== id);
    d.volumes = d.volumes.filter((x) => x.projectId !== id);
    d.valueChain = d.valueChain.filter((x) => x.projectId !== id);
    d.alerts = d.alerts.filter((x) => x.projectId !== id);
    d.aliases = d.aliases.filter((x) => x.projectId !== id);
    d.sapCodes = d.sapCodes.filter((x) => x.projectId !== id);
    d.assignments = d.assignments.filter((x) => x.projectId !== id);
    d.projectHistory = d.projectHistory.filter((x) => x.snapshot.id !== id);
    d.sapQueue = d.sapQueue.filter((x) => x.projectId !== id);
    d.stageWeights = d.stageWeights.filter((x) => x.projectId !== id);
    d.workItems = d.workItems.filter((x) => x.projectId !== id);
    d.workItemFacts = d.workItemFacts.filter((x) => x.projectId !== id);
    d.stageMilestones = d.stageMilestones.filter((x) => x.projectId !== id);
    d.keyMilestones = d.keyMilestones.filter((x) => x.projectId !== id);
    d.projectContractors = d.projectContractors.filter((x) => x.projectId !== id);
    d.dailyManpowerShifts = d.dailyManpowerShifts.filter((x) => x.projectId !== id);
    d.dailyEquipment = d.dailyEquipment.filter((x) => x.projectId !== id);
    // dim cleanup: xóa customer/team khi không còn project nào dùng
    if (!d.projects.some((x) => x.customerId === proj.customerId)) {
      d.customers = d.customers.filter((x) => x.id !== proj.customerId);
    }
    if (!d.projects.some((x) => x.teamKdId === proj.teamKdId)) {
      d.teams = d.teams.filter((x) => x.id !== proj.teamKdId);
    }
    persist();
  },

  changePassword(email: string, passwordHash: string) {
    const u = this.findAccount(email);
    if (u) u.passwordHash = passwordHash;
  },

  updateLastLogin(email: string) {
    const u = this.findAccount(email);
    if (u) u.lastLoginAt = new Date().toISOString();
    persist();
  },

  setAccountActive(email: string, isActive: boolean) {
    const u = this.findAccount(email);
    if (u) u.isActive = isActive;
  },

  // ---- Audit log ----
  getAuditLog(): AuditLogEntry[] {
    return [...getData().auditLog].sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  },

  logAudit(
    tableName: string,
    recordId: string,
    field: string,
    oldValue: string,
    newValue: string,
    changedBy: string,
    note = '',
  ) {
    const nextId = getData().auditLog.length + 1;
    getData().auditLog.push({
      id: nextId,
      tableName,
      recordId,
      field,
      oldValue,
      newValue,
      changedBy,
      changedAt: new Date().toISOString(),
      note,
    });
    persist();
  },

  // ---- Activity log (retention 14 ngày, lazy cleanup) ----
  getActivity(): ActivityLogEntry[] {
    return [...getData().activityLog].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  logActivity(entry: { userEmail: string; userName: string; action: string; detail: string; ip: string; userAgent: string }) {
    const d = getData();
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    d.activityLog = d.activityLog.filter((a) => new Date(a.createdAt).getTime() >= cutoff);
    const id = (d.activityLog[d.activityLog.length - 1]?.id ?? 0) + 1;
    d.activityLog.push({ id, ...entry, createdAt: new Date().toISOString() });
    persist();
  },

  // ---- SAP queue ----
  getSapQueue(): SapQueueItem[] {
    return getData().sapQueue;
  },

  addSapQueueItem(sapCode: string, sourceDocType: string, projectNameHint: string) {
    const nextId = getData().sapQueue.length + 1;
    getData().sapQueue.push({
      id: nextId,
      sapCode,
      sourceDocType,
      projectNameHint,
      status: 'pending',
      projectId: null,
      detectedAt: new Date().toISOString(),
    });
  },

  resolveSapQueue(id: number, projectId: number) {
    const q = getData().sapQueue.find((x) => x.id === id);
    if (!q) return false;
    q.status = 'resolved';
    q.projectId = projectId;
    return true;
  },

  // ---- Snapshot / lock số liệu ----
  lockMonth(yearMonth: string, lockedBy: string) {
    const facts = getData().facts.filter((f) => f.yearMonth === yearMonth);
    for (const f of facts) {
      f.snapshotLockedAt = new Date().toISOString();
      f.lockedBy = lockedBy;
    }
  },

  isMonthLocked(yearMonth: string): boolean {
    const facts = getData().facts.filter((f) => f.yearMonth === yearMonth);
    return facts.length > 0 && facts.every((f) => f.snapshotLockedAt != null);
  },

  // ---- Mutations (mock: mutate in-memory) ----
  saveMonthlyFact(
    projectId: number,
    yearMonth: string,
    patch: Partial<Pick<FactProgressMonthly, 'pctPlan' | 'pctActual' | 'ac' | 'equipmentActual' | 'bottleneckStage'>>,
    changedBy = 'system',
  ): SaveFactResult {
    const d = getData();
    const proj = d.projects.find((p) => p.id === projectId);
    if (!proj) return 'not_found';
    const prev = this.getLatestFact(projectId, yearMonth);
    const bac = proj.contractValue; // snapshot BAC tại thời điểm ghi
    // Mốc là ngày CUỐI THÁNG đang lưu - sửa lại tháng cũ phải ra đúng PV của tháng đó.
    const at = new Date(`${endOfMonth(yearMonth)}T00:00:00Z`);
    const pctPlanDuration = calcDurationPctComplete(proj.plannedStartDate, proj.plannedFinishDate, at) ?? 0;
    const pv = pctPlanDuration * bac;

    if (prev) {
      const fields = Object.keys(patch) as (keyof typeof patch)[];
      const note = fields.map((k) => `${k}: ${String(prev[k])} → ${String(patch[k])}`).join('; ');
      const pctPlan = patch.pctPlan ?? prev.pctPlan;          // số nhập tay, chỉ lưu để audit
      const pctActual = patch.pctActual ?? prev.pctActual;
      const ac = patch.ac ?? prev.ac;
      const ev = pctActual * bac;
      const spi = calcSpi(ev, pv);
      const cpi = ac ? ev / ac : null;
      // Append-only: hạ cờ bản cũ rồi thêm bản mới - chỉ 1 dòng isLatest = true mỗi (projectId, yearMonth).
      for (const f of d.facts) if (f.projectId === projectId && f.yearMonth === yearMonth) f.isLatest = false;
      d.facts.push({
        ...prev,
        ...patch,
        pctPlan,
        pctActual,
        ac,
        bac,
        pv,
        ev,
        spi,
        cpi,
        isLatest: true,
        version: prev.version + 1,
        changedBy,
        changedAt: new Date().toISOString(),
        changeNote: note,
      });
      proj.updatedAt = new Date().toISOString();
      this.logAudit('fact_progress_monthly', `${projectId}/${yearMonth}`, fields.join(','), '', note, changedBy);
      return 'updated';
    }

    // Chưa có dòng nào của tháng này - dựng "baseline" từ tháng gần nhất TRƯỚC đó cùng dự án.
    const baseline = this._latestFacts()
      .filter((f) => f.projectId === projectId && f.yearMonth < yearMonth)
      .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0];
    const baselineVal = {
      pctPlan: baseline?.pctPlan ?? 0,
      pctActual: baseline?.pctActual ?? 0,
      ac: baseline?.ac ?? 0,
      bottleneckStage: baseline?.bottleneckStage ?? null,
      manpowerActual: baseline?.manpowerActual ?? 0,
      equipmentActual: baseline?.equipmentActual ?? 0,
    };
    const fields = Object.keys(patch) as (keyof typeof patch)[];
    const note = `create; ${fields.map((k) => `${k}: ${String(baselineVal[k as keyof typeof baselineVal])} → ${String(patch[k])}`).join('; ')}`;
    const pctPlan = patch.pctPlan ?? baselineVal.pctPlan;
    const pctActual = patch.pctActual ?? baselineVal.pctActual;
    const ac = patch.ac ?? baselineVal.ac;
    const ev = pctActual * bac;
    const spi = calcSpi(ev, pv);
    const cpi = ac ? ev / ac : null;
    for (const f of d.facts) if (f.projectId === projectId && f.yearMonth === yearMonth) f.isLatest = false;
    d.facts.push({
      projectId,
      yearMonth,
      pctPlan,
      pctActual,
      actualStartDate: baseline?.actualStartDate ?? proj.actualStartDate,
      actualFinishDate: baseline?.actualFinishDate ?? proj.actualFinishDate,
      bac,
      pv,
      ev,
      ac,
      spi,
      cpi,
      bottleneckStage: patch.bottleneckStage !== undefined ? patch.bottleneckStage : baselineVal.bottleneckStage,
      equipmentPlanned: baseline?.equipmentPlanned ?? 0,
      equipmentActual: patch.equipmentActual ?? baselineVal.equipmentActual,
      isLatest: true,
      manpowerPlanned: baseline?.manpowerPlanned ?? 0,
      manpowerActual: baselineVal.manpowerActual,
      snapshotLockedAt: null,
      lockedBy: null,
      version: 1,
      changedBy,
      changedAt: new Date().toISOString(),
      changeNote: note,
    });
    proj.updatedAt = new Date().toISOString();
    this.logAudit('fact_progress_monthly', `${projectId}/${yearMonth}`, fields.join(','), '', note, changedBy);
    return 'created';
  },

  /** Ghi các giai đoạn chuỗi giá trị của 1 tháng (upsert theo projectId/stageCode/yearMonth). */
  saveValueChain(
    projectId: number,
    yearMonth: string,
    stages: StageInput[],
    changedBy = 'system',
  ) {
    const d = getData();
    d.valueChain = d.valueChain.filter((v) => !(v.projectId === projectId && v.yearMonth === yearMonth));
    for (const s of stages) {
      d.valueChain.push({ projectId, stageCode: s.stageCode, yearMonth, pctComplete: s.pctComplete, applicable: s.applicable });
    }
    this.logAudit(
      'fact_value_chain_progress', `${projectId}/${yearMonth}`, 'pctComplete', '',
      stages.map((s) => `${s.stageCode}:${s.pctComplete}/${s.applicable}`).join(','), changedBy,
    );
    persist();
  },

  /** Import hàng loạt % TT (pctActual) cho 1 tháng - tự tạo dòng mới nếu dự án chưa có fact tháng này. */
  importMonthlyFacts(
    yearMonth: string,
    rows: { projectId: number; pctActual: number }[],
    changedBy = 'system',
  ): { imported: number; failed: { projectId: number; reason: 'not_found' }[] } {
    let imported = 0;
    const failed: { projectId: number; reason: 'not_found' }[] = [];
    for (const r of rows) {
      const result = this.saveMonthlyFact(r.projectId, yearMonth, { pctActual: r.pctActual }, changedBy);
      if (result === 'not_found') {
        failed.push({ projectId: r.projectId, reason: 'not_found' });
        continue;
      }
      imported++;
    }
    return { imported, failed };
  },

  saveFinancial(
    projectId: number,
    yearMonth: string,
    patch: Partial<
      Pick<
        FactFinancial,
        'revenueCumulative' | 'costActualCumulative' | 'arCollected' | 'arOutstanding' | 'arOverdue'
      >
    >,
    changedBy = 'system',
  ): SaveFactResult {
    const d = getData();
    const proj = d.projects.find((x) => x.id === projectId);
    if (!proj) return 'not_found';
    const contractValue = proj.contractValue;
    const prev = this._latestFinancial().find((x) => x.projectId === projectId && x.yearMonth === yearMonth);

    if (prev) {
      const fields = Object.keys(patch) as (keyof typeof patch)[];
      const note = fields.map((k) => `${k}: ${String(prev[k])} → ${String(patch[k])}`).join('; ');
      // arOutstanding tự tính = Giá trị HĐ − Đã thu − Quá hạn (không nhận từ client).
      const collected = patch.arCollected ?? prev.arCollected;
      const overdue = patch.arOverdue ?? prev.arOverdue;
      const next: FactFinancial = {
        ...prev,
        ...patch,
        arOutstanding: Math.round((contractValue - collected - overdue) * 10) / 10,
        isLatest: true,
        version: prev.version + 1,
        changedBy,
        changedAt: new Date().toISOString(),
        changeNote: note,
      };
      next.grossProfit = Math.round((next.revenueCumulative - next.costActualCumulative) * 10) / 10;
      next.grossMarginPct = next.revenueCumulative
        ? (next.revenueCumulative - next.costActualCumulative) / next.revenueCumulative
        : 0;
      // Append-only: hạ cờ bản cũ rồi thêm bản mới - chỉ 1 dòng isLatest = true mỗi (projectId, yearMonth).
      for (const f of d.financial) if (f.projectId === projectId && f.yearMonth === yearMonth) f.isLatest = false;
      d.financial.push(next);
      this.logAudit('fact_financial', `${projectId}/${yearMonth}`, fields.join(','), '', note, changedBy);
      return 'updated';
    }

    // Chưa có dòng nào của tháng này - dựng "baseline" từ tháng gần nhất TRƯỚC đó cùng dự án.
    const baseline = this._latestFinancial()
      .filter((f) => f.projectId === projectId && f.yearMonth < yearMonth)
      .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0];
    const baselineVal = {
      revenueCumulative: baseline?.revenueCumulative ?? 0,
      costActualCumulative: baseline?.costActualCumulative ?? 0,
      arCollected: baseline?.arCollected ?? 0,
      arOverdue: baseline?.arOverdue ?? 0,
    };
    const fields = Object.keys(patch) as (keyof typeof patch)[];
    const note = `create; ${fields.map((k) => `${k}: ${String(baselineVal[k as keyof typeof baselineVal] ?? 0)} → ${String(patch[k])}`).join('; ')}`;
    const collected = patch.arCollected ?? baselineVal.arCollected;
    const overdue = patch.arOverdue ?? baselineVal.arOverdue;
    const revenueCumulative = patch.revenueCumulative ?? baselineVal.revenueCumulative;
    const costActualCumulative = patch.costActualCumulative ?? baselineVal.costActualCumulative;
    const revenuePeriod = revenueCumulative - baselineVal.revenueCumulative;
    const costActualPeriod = costActualCumulative - baselineVal.costActualCumulative;
    const arOutstanding = Math.round((contractValue - collected - overdue) * 10) / 10;
    const grossProfit = Math.round((revenueCumulative - costActualCumulative) * 10) / 10;
    const grossMarginPct = revenueCumulative ? (revenueCumulative - costActualCumulative) / revenueCumulative : 0;
    const backlog = baseline?.backlog ?? 0;
    const next: FactFinancial = {
      projectId,
      yearMonth,
      revenuePeriod,
      revenueCumulative,
      costActualPeriod,
      costActualCumulative,
      grossProfit,
      grossMarginPct,
      backlog,
      arCollected: collected,
      arOutstanding,
      arOverdue: overdue,
      version: 1,
      isLatest: true,
      changedBy,
      changedAt: new Date().toISOString(),
      changeNote: note,
    };
    for (const f of d.financial) if (f.projectId === projectId && f.yearMonth === yearMonth) f.isLatest = false;
    d.financial.push(next);
    this.logAudit('fact_financial', `${projectId}/${yearMonth}`, fields.join(','), '', note, changedBy);
    return 'created';
  },

  saveProjectProfile(projectId: number, patch: Partial<Project>, changedBy = 'system') {
    const d = getData();
    const p = d.projects.find((x) => x.id === projectId);
    if (!p) return;
    const fields = Object.keys(patch) as (keyof Project)[];
    const note = fields
      .map((k) => `${k}: ${String((p as unknown as Record<string, unknown>)[k])} → ${String((patch as unknown as Record<string, unknown>)[k])}`)
      .join('; ');
    const now = new Date().toISOString();
    // Append-only: giữ snapshot cũ, không ghi đè lịch sử.
    d.projectHistory.push({ at: now, by: changedBy, note, snapshot: { ...p } });
    Object.assign(p, patch, { updatedAt: now, updatedBy: changedBy });
    this.logAudit('dim_project', String(projectId), fields.join(','), '', note, changedBy);
  },

  /**
   * Vong sua reviewer (tao du an nguyen tu): `stageWeights` (neu co) duoc kiem + ghi TRONG CUNG
   * lan goi nay - ban mock don luong nen chi can kiem tap giai doan TRUOC khi ghi bat cu gi (nem
   * `StagesChangedError` thi khong co du an nao duoc them vao `d.projects`), tuong duong hanh vi
   * rollback cua transaction Prisma (prisma-repo.ts).
   */
  createProject(input: CreateProjectInput, changedBy = 'system'): Project {
    const d = getData();
    const id = d.projects.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    const code = `M-${String(id).padStart(5, '0')}`;
    // F-1 (vòng sửa 1, vòng 2): kiểm trùng cả mã tự sinh khi không nhập mã - đồng bộ prisma-repo.
    const finalCode = input.currentAliasCode ?? code;
    if (isProjectCodeTakenIn(d, finalCode, null)) throw new ProjectCodeTakenError(finalCode);
    if (input.stageWeights) {
      const activeCodes = d.stages.filter((s) => s.isActive).map((s) => s.code);
      if (!isSameStageSet(input.stageWeights.map((w) => w.stageCode), activeCodes)) {
        throw new StagesChangedError();
      }
    }
    const now = new Date().toISOString();
    const p: Project = {
      id,
      masterCode: code,
      currentAliasCode: finalCode,
      projectName: input.projectName,
      customerId: input.customerId,
      teamKdId: input.teamKdId,
      marketCode: input.marketCode,
      projectType: input.projectType,
      priority: input.priority,
      contractValue: input.contractValue,
      tonnage: input.tonnage ?? 0,
      currencyCode: input.currencyCode ?? 'VND',
      contractDate: input.contractDate ?? null,
      plannedStartDate: input.plannedStartDate ?? null,
      plannedFinishDate: input.plannedFinishDate ?? null,
      committedHandoverDate: input.committedHandoverDate ?? null,
      actualStartDate: input.actualStartDate ?? null,
      actualFinishDate: input.actualFinishDate ?? null,
      penaltyValue: input.penaltyValue ?? null,
      penalized: input.penalized ?? false,
      isActive: true,
      factoryId: input.factoryId ?? null,
      contractValueOriginal: input.contractValueOriginal ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: changedBy,
      updatedBy: changedBy,
    };
    d.projects.push(p);
    if (input.currentAliasCode) {
      const aliasId = d.aliases.reduce((m, a) => Math.max(m, a.id), 0) + 1;
      d.aliases.push({
        id: aliasId,
        projectId: id,
        aliasCode: input.currentAliasCode,
        aliasType: 'Ma_CT',
        effectiveFrom: todayIso(),
        effectiveTo: null,
        reason: 'Mã CT khi tạo dự án',
        approvedBy: changedBy,
      });
    }
    if (input.stageWeights) replaceStageWeightsIn(d, id, input.stageWeights, changedBy);
    this.logAudit('dim_project', String(id), 'create', '', p.projectName, changedBy);
    return p;
  },

  addAssignment(projectId: number, userEmail: string, roleInProject: 'PIC' | 'Backup' = 'PIC') {
    const d = getData();
    const prev = d.assignments.find((a) => a.projectId === projectId && a.userEmail === userEmail);
    if (prev) {
      prev.roleInProject = roleInProject;
      return;
    }
    d.assignments.push({
      projectId,
      userEmail,
      roleInProject,
      assignedBy: 'system',
      assignedAt: new Date().toISOString(),
    });
  },

  /** Thay TOÀN BỘ bộ mốc của 1 dự án (bảng cấu hình, không phải fact append-only); sortOrder = thứ tự mảng. */
  replaceKeyMilestones(projectId: number, rows: KeyMilestoneInput[], changedBy = 'system') {
    const d = getData();
    const before = this.getKeyMilestones(projectId);
    let nextId = d.keyMilestones.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    d.keyMilestones = d.keyMilestones
      .filter((m) => m.projectId !== projectId)
      .concat(rows.map((r, i) => ({ id: nextId++, projectId, name: r.name, sortOrder: i + 1, plannedDate: r.plannedDate, actualDate: r.actualDate })));
    this.logAudit('project_key_milestone', String(projectId), 'replace', keyMsAuditText(before), keyMsAuditText(rows), changedBy);
  },

  closeAlert(id: number, action: string, changedBy = 'system', note = '') {
    const a = getData().alerts.find((x) => x.id === id);
    if (!a) return;
    a.closedAt = new Date().toISOString();
    a.action = action;
    a.closedBy = changedBy;
    a.closeNote = note;
    this.logAudit('alert_log', String(id), 'action', '', action, changedBy, note);
  },

  addSapCode(projectId: number, sapCode: string, sourceDocType: string, changedBy = 'system') {
    const existing = getData().sapCodes.find((s) => s.sapCode === sapCode);
    if (existing) return false;
    const nextId = Math.max(0, ...getData().sapCodes.map((s) => s.id)) + 1;
    getData().sapCodes.push({
      id: nextId,
      projectId,
      sapCode,
      sourceDocType,
      linkedAt: new Date().toISOString(),
      linkedBy: changedBy,
      note: '',
    });
    this.logAudit('project_sap_codes', String(projectId), 'sapCode', '', sapCode, changedBy);
    return true;
  },
};

/**
 * P2B/P3A/P3B: gộp read repo + repo thông báo vào repo qua `Object.assign` (mutate object gốc, tầng
 * trên chỉ import `repo` như cũ) - dùng dạng gán lại (không phải statement rời) để kiểu tĩnh của
 * `repo` gồm đủ cả 2 phần gộp (test import thẳng `./mock-repo` mới thấy được các hàm này).
 */
export const repo = Object.assign(
  { ...coreRepo, ...makeEntryMockRepo({ getData, persist }), ...makeFormMockRepo({ getData, persist }) },
  createReadMock(getData),
  makeNotifyMockRepo({ getData, persist }),
  makeBackfillMockRepo({ getData, persist }),
);
