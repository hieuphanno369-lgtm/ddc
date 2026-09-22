import { buildRepoData, CURRENT_MONTH, SEED_VERSION, type RepoData } from '@/data/seed/history';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { StageInput } from '@/lib/stages';
import type {
  ActivityLogEntry,
  AlertLog,
  AuditLogEntry,
  CurrencyCode,
  Customer,
  FactProgressMonthly,
  FactFinancial,
  FactVolume,
  Market,
  Priority,
  Project,
  ProjectAlias,
  ProjectAssignment,
  ProjectHistoryEntry,
  ProjectSapCode,
  ProjectPhoto,
  ProjectType,
  Role,
  SapQueueItem,
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

export const repo = {
  reset() {
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

  /** Fact bất biến (append-only): trả về version mới nhất mỗi (projectId, yearMonth). */
  _latestFacts(): FactProgressMonthly[] {
    const map = new Map<string, FactProgressMonthly>();
    for (const f of getData().facts) {
      const k = `${f.projectId}|${f.yearMonth}`;
      const cur = map.get(k);
      if (!cur || f.version > cur.version) map.set(k, f);
    }
    return [...map.values()];
  },

  _latestFinancial(): FactFinancial[] {
    const map = new Map<string, FactFinancial>();
    for (const f of getData().financial) {
      const k = `${f.projectId}|${f.yearMonth}`;
      const cur = map.get(k);
      if (!cur || f.version > cur.version) map.set(k, f);
    }
    return [...map.values()];
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

  getPhotos(projectId: number, yearMonth?: string): ProjectPhoto[] {
    return getData()
      .photos.filter(
        (ph) => ph.projectId === projectId && (!yearMonth || ph.yearMonth === yearMonth),
      )
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  },

  getPhotoById(photoId: number): ProjectPhoto | null {
    return getData().photos.find((ph) => ph.id === photoId) ?? null;
  },

  addPhoto(projectId: number, yearMonth: string, url: string, caption: string, uploadedBy: string): ProjectPhoto {
    const nextId = Math.max(0, ...getData().photos.map((p) => p.id)) + 1;
    const photo: ProjectPhoto = {
      id: nextId,
      projectId,
      yearMonth,
      url,
      caption,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
    };
    getData().photos.push(photo);
    return photo;
  },

  deletePhoto(photoId: number): boolean {
    const photos = getData().photos;
    const idx = photos.findIndex((p) => p.id === photoId);
    if (idx < 0) return false;
    photos.splice(idx, 1);
    return true;
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
  createDimValue(field: 'customer' | 'team', name: string): number {
    const list = this._dimList(field);
    const n = name.trim();
    const existing = list.find(
      (x) => x.name.toLowerCase() === n.toLowerCase() || x.aliases.some((a) => a.toLowerCase() === n.toLowerCase()),
    );
    if (existing) return existing.id;
    const id = list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    if (field === 'customer') {
      (list as Customer[]).push({ id, name: n, group: 'Khác', aliases: [], isActive: true, mergedIntoId: null });
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
    return n;
  },

  getDimFieldValues(field: 'customer' | 'team') {
    const d = getData();
    return this._dimList(field).map((x) => ({
      id: x.id,
      name: x.name,
      isActive: x.isActive,
      mergedIntoId: x.mergedIntoId,
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

  setUserRole(email: string, role: Role, canViewFinance: boolean) {
    const u = this.findAccount(email);
    if (u) {
      u.role = role;
      u.canViewFinance = canViewFinance;
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
    d.photos = d.photos.filter((x) => x.projectId !== id);
    d.assignments = d.assignments.filter((x) => x.projectId !== id);
    d.projectHistory = d.projectHistory.filter((x) => x.snapshot.id !== id);
    d.sapQueue = d.sapQueue.filter((x) => x.projectId !== id);
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

  /** Reset go-live: xóa hết data nghiệp vụ, giữ dim tables. */
  resetAllData() {
    const d = getData();
    d.projects = [];
    d.facts = [];
    d.valueChain = [];
    d.financial = [];
    d.volumes = [];
    d.alerts = [];
    d.aliases = [];
    d.sapCodes = [];
    d.photos = [];
    d.assignments = [];
    d.sapQueue = [];
    d.auditLog = [];
    d.projectHistory = [];
  },

  // ---- Mutations (mock: mutate in-memory) ----
  saveMonthlyFact(
    projectId: number,
    yearMonth: string,
    patch: Partial<Pick<FactProgressMonthly, 'pctPlan' | 'pctActual' | 'ac' | 'equipmentActual' | 'bottleneckStage'>>,
    changedBy = 'system',
  ) {
    const d = getData();
    const prev = this.getLatestFact(projectId, yearMonth);
    if (!prev) return;
    const proj = d.projects.find((p) => p.id === projectId)!;
    const fields = Object.keys(patch) as (keyof typeof patch)[];
    const note = fields.map((k) => `${k}: ${String(prev[k])} → ${String(patch[k])}`).join('; ');
    const bac = proj.contractValue; // snapshot BAC tại thời điểm ghi
    const pctPlan = patch.pctPlan ?? prev.pctPlan;
    const pctActual = patch.pctActual ?? prev.pctActual;
    const ac = patch.ac ?? prev.ac;
    const pv = pctPlan * bac;
    const ev = pctActual * bac;
    const spi = pv ? ev / pv : null;
    const cpi = ac ? ev / ac : null;
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
      version: prev.version + 1,
      changedBy,
      changedAt: new Date().toISOString(),
      changeNote: note,
    });
    proj.updatedAt = new Date().toISOString();
    this.logAudit('fact_progress_monthly', `${projectId}/${yearMonth}`, fields.join(','), '', note, changedBy);
  },

  /** Ghi 7 giai đoạn chuỗi giá trị của 1 tháng (upsert theo projectId/stageCode/yearMonth). */
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

  /** Import hàng loạt % TT (pctActual) cho 1 tháng - chỉ update fact đã tồn tại. */
  importMonthlyFacts(yearMonth: string, rows: { projectId: number; pctActual: number }[], changedBy = 'system') {
    let n = 0;
    for (const r of rows) {
      const exists = getData().facts.some((f) => f.projectId === r.projectId && f.yearMonth === yearMonth);
      if (!exists) continue;
      this.saveMonthlyFact(r.projectId, yearMonth, { pctActual: r.pctActual }, changedBy);
      n++;
    }
    return n;
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
  ) {
    const d = getData();
    const prev = this._latestFinancial().find((x) => x.projectId === projectId && x.yearMonth === yearMonth);
    if (!prev) return;
    const fields = Object.keys(patch) as (keyof typeof patch)[];
    const note = fields.map((k) => `${k}: ${String(prev[k])} → ${String(patch[k])}`).join('; ');
    // arOutstanding tự tính = Giá trị HĐ − Đã thu − Quá hạn (không nhận từ client).
    const proj = d.projects.find((x) => x.id === projectId);
    const contractValue = proj?.contractValue ?? 0;
    const collected = patch.arCollected ?? prev.arCollected;
    const overdue = patch.arOverdue ?? prev.arOverdue;
    const next: FactFinancial = {
      ...prev,
      ...patch,
      arOutstanding: Math.round((contractValue - collected - overdue) * 10) / 10,
      version: prev.version + 1,
      changedBy,
      changedAt: new Date().toISOString(),
      changeNote: note,
    };
    next.grossProfit = Math.round((next.revenueCumulative - next.costActualCumulative) * 10) / 10;
    next.grossMarginPct = next.revenueCumulative
      ? (next.revenueCumulative - next.costActualCumulative) / next.revenueCumulative
      : 0;
    d.financial.push(next);
    this.logAudit('fact_financial', `${projectId}/${yearMonth}`, fields.join(','), '', note, changedBy);
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

  createProject(
    input: {
      projectName: string;
      customerId: number;
      teamKdId: number;
      marketCode: Market;
      projectType: ProjectType;
      priority: Priority;
      contractValue: number;
      tonnage?: number;
      currencyCode?: CurrencyCode;
      contractDate?: string | null;
      plannedStartDate?: string | null;
      plannedFinishDate?: string | null;
      committedHandoverDate?: string | null;
      penaltyValue?: number | null;
    },
    changedBy = 'system',
  ): Project {
    const d = getData();
    const id = d.projects.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    const code = `M-${String(id).padStart(5, '0')}`;
    const now = new Date().toISOString();
    const p: Project = {
      id,
      masterCode: code,
      currentAliasCode: code,
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
      actualStartDate: null,
      actualFinishDate: null,
      penaltyValue: input.penaltyValue ?? null,
      penalized: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: changedBy,
      updatedBy: changedBy,
    };
    d.projects.push(p);
    this.logAudit('dim_project', String(id), 'create', '', p.projectName, changedBy);
    return p;
  },

  addAssignment(projectId: number, userEmail: string, roleInProject: 'PIC' | 'Backup' = 'PIC') {
    getData().assignments.push({
      projectId,
      userEmail,
      roleInProject,
      assignedBy: 'system',
      assignedAt: new Date().toISOString(),
    });
  },

  closeAlert(id: number, action: string, changedBy = 'system') {
    const a = getData().alerts.find((x) => x.id === id);
    if (!a) return;
    a.closedAt = new Date().toISOString();
    a.action = action;
    this.logAudit('alert_log', String(id), 'action', '', action, changedBy);
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

export const currentMonth = CURRENT_MONTH;
