import type { RepoData } from '@/data/seed/history';
import type { EquipmentCellInput, ManpowerCellInput } from '@/lib/daily-entry';
import type {
  AlertLog, AuditLogEntry, Contractor, CurrencyCode, ExchangeRate, FactDailyManpowerShift, FactVolume, Factory,
  FxSource, JobName, JobRunEntry, JobTrigger, NewEngineAlert, Shift,
} from './types';

export interface EntryMockDeps {
  getData: () => RepoData;
  persist: () => void;
}

/** Ghi 1 dòng audit_log trong mock (khuôn `logAudit` của mock-repo.ts). */
function auditMock(
  d: RepoData,
  tableName: string,
  recordId: string,
  field: string,
  oldValue: string,
  newValue: string,
  changedBy: string,
  note = '',
): void {
  const entry: AuditLogEntry = {
    id: d.auditLog.length + 1,
    tableName,
    recordId,
    field,
    oldValue,
    newValue,
    changedBy,
    changedAt: new Date().toISOString(),
    note,
  };
  d.auditLog.push(entry);
}

/**
 * Hàm repo P2A (Task 1, 3-8) cho mock-repo - hợp nhất qua spread ở mock-repo.ts, KHÔNG sửa trực
 * tiếp `coreRepo` cho từng Task để giảm xung đột với B (K3, ke-hoach.md P2A).
 */
export function makeEntryMockRepo({ getData, persist }: EntryMockDeps) {
  return {
    getShifts(): Shift[] {
      return getData()
        .shifts.filter((s) => s.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },

    getDailyManpowerByShift(projectId: number, from: string, to: string): FactDailyManpowerShift[] {
      const d = getData();
      const shiftOrder = new Map(d.shifts.map((s) => [s.code, s.sortOrder]));
      return d.dailyManpowerShifts
        .filter((m) => m.projectId === projectId && m.workDate >= from && m.workDate <= to)
        .sort((a, b) => {
          if (a.workDate !== b.workDate) return a.workDate < b.workDate ? -1 : 1;
          if (a.contractorId !== b.contractorId) return a.contractorId - b.contractorId;
          return (shiftOrder.get(a.shiftCode) ?? 0) - (shiftOrder.get(b.shiftCode) ?? 0);
        });
    },

    /** G-18: gan 1 nha thau vao du an. not_found = du an hoac nha thau khong ton tai/khong active. */
    addProjectContractor(projectId: number, contractorId: number, by: string): 'added' | 'exists' | 'not_found' {
      const d = getData();
      const project = d.projects.find((p) => p.id === projectId && p.isActive);
      const contractor = d.contractors.find((c) => c.id === contractorId && c.isActive);
      if (!project || !contractor) return 'not_found';
      const exists = d.projectContractors.some((pc) => pc.projectId === projectId && pc.contractorId === contractorId);
      if (exists) return 'exists';
      d.projectContractors.push({ projectId, contractorId });
      auditMock(d, 'project_contractor', `${projectId}/${contractorId}`, 'add', '', contractor.name, by);
      persist();
      return 'added';
    },

    /** Q5=a: chan go khi nha thau da co so lieu nhan luc/thiet bi o du an nay. */
    removeProjectContractor(projectId: number, contractorId: number, by: string): 'removed' | 'has_data' | 'not_member' {
      const d = getData();
      const idx = d.projectContractors.findIndex((pc) => pc.projectId === projectId && pc.contractorId === contractorId);
      if (idx < 0) return 'not_member';
      const hasData =
        d.dailyManpowerShifts.some((m) => m.projectId === projectId && m.contractorId === contractorId) ||
        d.dailyEquipment.some((e) => e.projectId === projectId && e.contractorId === contractorId);
      if (hasData) return 'has_data';
      const contractor = d.contractors.find((c) => c.id === contractorId);
      d.projectContractors.splice(idx, 1);
      auditMock(d, 'project_contractor', `${projectId}/${contractorId}`, 'remove', contractor?.name ?? '', '', by);
      persist();
      return 'removed';
    },

    /** Q4=a: tao nha thau moi trong buoc nhap; trung ten (khong phan biet hoa thuong) voi nha thau
     * active thi tra ve nha thau do, khong tao them. */
    createContractor(name: string, scopeOfWork: string, by: string): Contractor {
      const d = getData();
      const trimmed = name.trim();
      const existing = d.contractors.find((c) => c.isActive && c.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing;
      const id = d.contractors.reduce((m, c) => Math.max(m, c.id), 0) + 1;
      const created: Contractor = { id, name: trimmed, scopeOfWork, isActive: true, mergedIntoId: null };
      d.contractors.push(created);
      auditMock(d, 'dim_contractor', String(id), 'create', '', created.name, by);
      persist();
      return created;
    },

    /** Ghi nhan luc theo ca + thiet bi theo ngay cua 1 (projectId, workDate). Khong bao gio xoa dong. */
    saveDailyResources(
      projectId: number,
      workDate: string,
      input: { manpower: ManpowerCellInput[]; equipment: EquipmentCellInput[] },
      by: string,
      note: string,
    ): { created: number; updated: number; unchanged: number } {
      const d = getData();
      let created = 0;
      let updated = 0;
      let unchanged = 0;

      for (const m of input.manpower) {
        const prev = d.dailyManpowerShifts.find(
          (e) => e.projectId === projectId && e.workDate === workDate && e.contractorId === m.contractorId && e.shiftCode === m.shiftCode,
        );
        if (!prev) {
          if (m.plannedHeadcount === 0 && m.actualHeadcount === 0) {
            unchanged++;
            continue;
          }
          d.dailyManpowerShifts.push({
            projectId, contractorId: m.contractorId, workDate, shiftCode: m.shiftCode,
            plannedHeadcount: m.plannedHeadcount, actualHeadcount: m.actualHeadcount,
          });
          created++;
          continue;
        }
        if (prev.plannedHeadcount === m.plannedHeadcount && prev.actualHeadcount === m.actualHeadcount) {
          unchanged++;
          continue;
        }
        const old = `${prev.plannedHeadcount}/${prev.actualHeadcount}`;
        prev.plannedHeadcount = m.plannedHeadcount;
        prev.actualHeadcount = m.actualHeadcount;
        auditMock(
          d, 'fact_daily_manpower', `${projectId}/${m.contractorId}/${workDate}/${m.shiftCode}`,
          'plannedHeadcount,actualHeadcount', old, `${m.plannedHeadcount}/${m.actualHeadcount}`, by, note,
        );
        updated++;
      }

      for (const e of input.equipment) {
        const prev = d.dailyEquipment.find(
          (x) => x.projectId === projectId && x.workDate === workDate && x.contractorId === e.contractorId && x.equipmentId === e.equipmentId,
        );
        if (!prev) {
          if (e.qtyPlanned === 0 && e.qtyActual === 0) {
            unchanged++;
            continue;
          }
          d.dailyEquipment.push({
            projectId, contractorId: e.contractorId, equipmentId: e.equipmentId, workDate,
            qtyPlanned: e.qtyPlanned, qtyActual: e.qtyActual,
          });
          created++;
          continue;
        }
        if (prev.qtyPlanned === e.qtyPlanned && prev.qtyActual === e.qtyActual) {
          unchanged++;
          continue;
        }
        const old = `${prev.qtyPlanned}/${prev.qtyActual}`;
        prev.qtyPlanned = e.qtyPlanned;
        prev.qtyActual = e.qtyActual;
        auditMock(
          d, 'fact_daily_equipment_usage', `${projectId}/${e.contractorId}/${e.equipmentId}/${workDate}`,
          'qtyPlanned,qtyActual', old, `${e.qtyPlanned}/${e.qtyActual}`, by, note,
        );
        updated++;
      }

      persist();
      return { created, updated, unchanged };
    },

    /** T8 (Task 6): tao/sua khu vuc san xuat - trung ten (khong phan biet hoa thuong) voi khu vuc
     * KHAC id -> 'duplicate_name'; id khong co -> 'not_found'. */
    saveFactory(
      input: { id?: number; name: string; region: string; capacityTonPerYear: number },
      by: string,
    ): Factory | 'duplicate_name' | 'not_found' {
      const d = getData();
      const name = input.name.trim();
      const dup = d.factories.find(
        (f) => f.name.toLowerCase() === name.toLowerCase() && (input.id == null || f.id !== input.id),
      );
      if (dup) return 'duplicate_name';

      if (input.id != null) {
        const existing = d.factories.find((f) => f.id === input.id);
        if (!existing) return 'not_found';
        const old = `${existing.name}/${existing.region}/${existing.capacityTonPerYear}`;
        existing.name = name;
        existing.region = input.region;
        existing.capacityTonPerYear = input.capacityTonPerYear;
        auditMock(d, 'dim_factory', String(input.id), 'name,region,capacityTonPerYear', old, `${existing.name}/${existing.region}/${existing.capacityTonPerYear}`, by);
        persist();
        return existing;
      }
      const id = d.factories.reduce((m, f) => Math.max(m, f.id), 0) + 1;
      const created: Factory = { id, name, region: input.region, capacityTonPerYear: input.capacityTonPerYear, isActive: true };
      d.factories.push(created);
      auditMock(d, 'dim_factory', String(id), 'create', '', created.name, by);
      persist();
      return created;
    },

    setFactoryActive(id: number, isActive: boolean, by: string): boolean {
      const d = getData();
      const f = d.factories.find((x) => x.id === id);
      if (!f) return false;
      const old = String(f.isActive);
      f.isActive = isActive;
      auditMock(d, 'dim_factory', String(id), 'isActive', old, String(isActive), by);
      persist();
      return true;
    },

    getVolumes(projectId: number, yearMonth: string): FactVolume[] {
      return getData().volumes.filter((v) => v.projectId === projectId && v.yearMonth === yearMonth);
    },

    /** Upsert khoa (projectId, yearMonth, factoryId); audit khi created/updated. */
    saveVolume(projectId: number, yearMonth: string, factoryId: number, tonnageProcessed: number, by: string): 'created' | 'updated' | 'unchanged' {
      const d = getData();
      const prev = d.volumes.find((v) => v.projectId === projectId && v.yearMonth === yearMonth && v.factoryId === factoryId);
      if (!prev) {
        d.volumes.push({ projectId, yearMonth, factoryId, tonnageProcessed });
        auditMock(d, 'fact_volume', `${projectId}/${yearMonth}/${factoryId}`, 'tonnageProcessed', '', String(tonnageProcessed), by);
        persist();
        return 'created';
      }
      if (prev.tonnageProcessed === tonnageProcessed) return 'unchanged';
      const old = String(prev.tonnageProcessed);
      prev.tonnageProcessed = tonnageProcessed;
      auditMock(d, 'fact_volume', `${projectId}/${yearMonth}/${factoryId}`, 'tonnageProcessed', old, String(tonnageProcessed), by);
      persist();
      return 'updated';
    },

    /** T6 (Task 7): tỷ giá theo tháng - mọi dòng, yearMonth desc. */
    getExchangeRates(): ExchangeRate[] {
      return [...getData().exchangeRates].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
    },

    upsertExchangeRate(row: { currencyCode: CurrencyCode; yearMonth: string; rateToVnd: number; source: FxSource }, by: string): void {
      const d = getData();
      const prev = d.exchangeRates.find((r) => r.currencyCode === row.currencyCode && r.yearMonth === row.yearMonth);
      const now = new Date().toISOString();
      if (!prev) {
        d.exchangeRates.push({ ...row, updatedBy: by, updatedAt: now });
        auditMock(d, 'dim_exchange_rate', `${row.currencyCode}/${row.yearMonth}`, 'rateToVnd,source', '', `${row.rateToVnd}/${row.source}`, by);
        persist();
        return;
      }
      const old = `${prev.rateToVnd}/${prev.source}`;
      prev.rateToVnd = row.rateToVnd;
      prev.source = row.source;
      prev.updatedBy = by;
      prev.updatedAt = now;
      auditMock(d, 'dim_exchange_rate', `${row.currencyCode}/${row.yearMonth}`, 'rateToVnd,source', old, `${row.rateToVnd}/${row.source}`, by);
      persist();
    },

    deleteExchangeRate(currencyCode: CurrencyCode, yearMonth: string, by: string): boolean {
      const d = getData();
      const idx = d.exchangeRates.findIndex((r) => r.currencyCode === currencyCode && r.yearMonth === yearMonth);
      if (idx < 0) return false;
      const prev = d.exchangeRates[idx];
      d.exchangeRates.splice(idx, 1);
      auditMock(d, 'dim_exchange_rate', `${currencyCode}/${yearMonth}`, 'delete', `${prev.rateToVnd}/${prev.source}`, '', by);
      persist();
      return true;
    },

    /** K4 (ke-hoach.md P2A): nhật ký chạy job định kỳ. */
    startJobRun(jobName: JobName, trigger: JobTrigger, by: string): number {
      const d = getData();
      const id = d.jobRuns.reduce((m, r) => Math.max(m, r.id), 0) + 1;
      d.jobRuns.push({ id, jobName, trigger, status: 'running', detail: '', startedAt: new Date().toISOString(), finishedAt: null, startedBy: by });
      persist();
      return id;
    },

    finishJobRun(id: number, status: 'ok' | 'error', detail: string): void {
      const d = getData();
      const row = d.jobRuns.find((r) => r.id === id);
      if (!row) return;
      row.status = status;
      row.detail = detail.slice(0, 1000);
      row.finishedAt = new Date().toISOString();
      persist();
    },

    getRecentJobRuns(jobName: JobName, limit: number): JobRunEntry[] {
      return getData()
        .jobRuns.filter((r) => r.jobName === jobName)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, limit);
    },

    /**
     * T11 (Task 8): ghi các alert engine vừa bắn - bỏ qua nếu đã có alert cùng (projectId, dedupeKey)
     * bất kể đóng/mở (K6), HOẶC đang có alert MỞ cùng (projectId, ruleCode). Trả số dòng tạo mới.
     */
    insertEngineAlerts(rows: NewEngineAlert[]): number {
      const d = getData();
      let created = 0;
      for (const r of rows) {
        const dup = d.alerts.some((a) => a.projectId === r.projectId && a.dedupeKey === r.dedupeKey);
        const openSameRule = d.alerts.some((a) => a.projectId === r.projectId && a.ruleCode === r.ruleCode && !a.closedAt);
        if (dup || openSameRule) continue;
        const id = d.alerts.reduce((m, a) => Math.max(m, a.id), 0) + 1;
        const entry: AlertLog = {
          id, projectId: r.projectId, alertType: r.alertType, ruleTriggered: r.ruleTriggered, message: r.message,
          openedAt: r.openedAt, closedAt: null, owner: r.owner, action: '', deadline: r.deadline,
          ruleCode: r.ruleCode, dedupeKey: r.dedupeKey, closedBy: null, closeNote: '',
          notifyChannel: null, notifySentAt: null, notifyError: null, notifyAttempts: 0,
        };
        d.alerts.push(entry);
        created++;
      }
      if (created > 0) persist();
      return created;
    },
  };
}

export { auditMock as audit };
