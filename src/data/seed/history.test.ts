import { describe, expect, it } from 'vitest';
import { buildRepoData, SEED_CURRENT_MONTH, SEED_HISTORY_MONTHS, seedPctPlanDuration } from './history';
import { seedProjects } from './projects';
import { DEFAULT_STAGE_WEIGHTS, validateStageWeights } from '@/lib/stages';
import { ERP_DETAIL_PROJECT_ID } from './erp';
import { sumManpowerShifts } from '@/lib/shifts';

describe('Seed dữ liệu', () => {
  const data = buildRepoData();

  it('17 dự án thật', () => {
    expect(data.projects.length).toBe(17);
  });

  it('12 tháng lịch sử × 17 dự án = 204 bản ghi tiến độ', () => {
    expect(SEED_HISTORY_MONTHS.length).toBe(12);
    expect(data.facts.length).toBe(17 * 12);
  });

  it('%TT luôn nằm trong [0, 1.5]', () => {
    for (const f of data.facts) {
      expect(f.pctActual).toBeGreaterThanOrEqual(0);
      expect(f.pctActual).toBeLessThanOrEqual(1.5);
    }
  });

  it('PV/EV/AC nhất quán với BAC', () => {
    for (const f of data.facts) {
      const p = data.projects.find((x) => x.id === f.projectId)!;
      // PV bám % KH THEO THỜI GIAN, không bám số nhập tay
      const seedP = seedProjects.find((x) => x.id === f.projectId)!;
      expect(f.pv).toBeCloseTo(seedPctPlanDuration(seedP, f.yearMonth) * p.contractValue, 0);
      expect(f.ev).toBeCloseTo(f.pctActual * p.contractValue, 0);
    }
  });

  it('PV KHÔNG còn bám pctPlan nhập tay (dự án 1: %KH duration ≠ finalPctPlan)', () => {
    const f = data.facts.find((x) => x.projectId === 1 && x.yearMonth === SEED_CURRENT_MONTH)!;
    expect(f.pv).not.toBeCloseTo(f.pctPlan * 477.8, 0);
  });

  it('Khâu nghẽn được gán cho tháng hiện tại', () => {
    const latest = data.facts.filter((f) => f.yearMonth === SEED_CURRENT_MONTH);
    expect(latest.length).toBe(17);
  });

  it('Có alert cảnh báo (SPI/CPI < 0.9 hoặc phạt)', () => {
    expect(data.alerts.length).toBeGreaterThan(0);
  });
});

describe('Seed ERP v2', () => {
  const data = buildRepoData();
  const lastDay = [...new Set(data.dailyManpowerShifts.map((m) => m.workDate))].sort().at(-1)!;

  it('7 giai đoạn dimension, sortOrder 1..7 không trùng', () => {
    expect(data.stages).toHaveLength(7);
    expect(data.stages.map((s) => s.sortOrder).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('mọi dự án có đủ 7 trọng số và tổng applicable = 100', () => {
    for (const p of data.projects) {
      const ws = data.stageWeights.filter((w) => w.projectId === p.id);
      expect(ws).toHaveLength(7);
      expect(validateStageWeights(ws).ok).toBe(true);
    }
  });

  it('trọng số đúng bộ đã duyệt 5/10/10/40/5/27/3 (KHÁC bộ cũ 6/12/10/34/5/28/5)', () => {
    expect(DEFAULT_STAGE_WEIGHTS.map((w) => w.weightPct)).toEqual([5, 10, 10, 40, 5, 27, 3]);
  });

  it('6 nhà thầu, tổng nhân lực ngày cuối KH 520 / TT 486', () => {
    expect(data.contractors).toHaveLength(6);
    const rows = sumManpowerShifts(data.dailyManpowerShifts.filter((m) => m.workDate === lastDay));
    expect(rows).toHaveLength(6);
    expect(rows.reduce((a, b) => a + b.plannedHeadcount, 0)).toBe(520);
    expect(rows.reduce((a, b) => a + b.actualHeadcount, 0)).toBe(486);
  });

  it('ngay cuoi co dung 12 dong ca, moi (contractor, ngay) co du 2 ma morning/evening', () => {
    const shiftRows = data.dailyManpowerShifts.filter((m) => m.workDate === lastDay);
    expect(shiftRows).toHaveLength(12);
    const byContractor = new Map<number, Set<string>>();
    for (const r of shiftRows) {
      const set = byContractor.get(r.contractorId) ?? new Set<string>();
      set.add(r.shiftCode);
      byContractor.set(r.contractorId, set);
    }
    expect(byContractor.size).toBe(6);
    for (const codes of byContractor.values()) {
      expect([...codes].sort()).toEqual(['evening', 'morning']);
    }
  });

  it('7 nhóm thiết bị, tổng ngày cuối KH 72 / TT 63', () => {
    expect(data.equipments).toHaveLength(7);
    const rows = data.dailyEquipment.filter((e) => e.workDate === lastDay);
    expect(rows.reduce((a, b) => a + b.qtyPlanned, 0)).toBe(72);
    expect(rows.reduce((a, b) => a + b.qtyActual, 0)).toBe(63);
  });

  it('đúng 7 ngày tracking liên tiếp', () => {
    const days = [...new Set(data.dailyManpowerShifts.map((m) => m.workDate))];
    expect(days).toHaveLength(7);
  });

  it('quan hệ nhiều-nhiều thật: 1 nhà thầu nhiều thiết bị VÀ 1 thiết bị nhiều nhà thầu', () => {
    const rows = data.dailyEquipment.filter((e) => e.workDate === lastDay);
    const byContractor = new Map<number, Set<number>>();
    const byEquipment = new Map<number, Set<number>>();
    for (const r of rows) {
      (byContractor.get(r.contractorId) ?? byContractor.set(r.contractorId, new Set()).get(r.contractorId)!).add(r.equipmentId);
      (byEquipment.get(r.equipmentId) ?? byEquipment.set(r.equipmentId, new Set()).get(r.equipmentId)!).add(r.contractorId);
    }
    expect([...byContractor.values()].some((s) => s.size > 1)).toBe(true);
    expect([...byEquipment.values()].some((s) => s.size > 1)).toBe(true);
  });

  it('10 hạng mục + 5 mốc chính, đúng 2 mốc đã có ngày thực tế', () => {
    expect(data.workItems.filter((w) => w.projectId === ERP_DETAIL_PROJECT_ID)).toHaveLength(10);
    const ms = data.keyMilestones.filter((m) => m.projectId === ERP_DETAIL_PROJECT_ID);
    expect(ms).toHaveLength(5);
    expect(ms.filter((m) => m.actualDate != null)).toHaveLength(2);
  });

  it('mọi fact seed đều isLatest = true (chưa có bản ghi đè nào)', () => {
    expect(data.facts.every((f) => f.isLatest)).toBe(true);
    expect(data.financial.every((f) => f.isLatest)).toBe(true);
  });

  it('assignment chỉ trỏ tới email có thật trong userRoles (nếu không RBAC khoá sạch app)', () => {
    const emails = new Set(data.userRoles.map((u) => u.email));
    for (const a of data.assignments) expect(emails.has(a.userEmail)).toBe(true);
  });

  it('moi alert seed co ruleCode va dedupeKey khong trung trong cung du an', () => {
    expect(data.alerts.length).toBeGreaterThan(0);
    for (const a of data.alerts) expect(a.ruleCode).not.toBeNull();
    const byProject = new Map<number, Set<string>>();
    for (const a of data.alerts) {
      const set = byProject.get(a.projectId) ?? new Set<string>();
      expect(set.has(a.dedupeKey!)).toBe(false);
      set.add(a.dedupeKey!);
      byProject.set(a.projectId, set);
    }
  });

  it('ke hoach thiet bi Gantt: 6 dong, plannedFinish >= plannedStart, unitNo >= 1, workItemId ton tai o du an 1', () => {
    expect(data.equipmentPlans).toHaveLength(6);
    const workItemIds = new Set(
      data.workItems.filter((w) => w.projectId === ERP_DETAIL_PROJECT_ID).map((w) => w.id),
    );
    for (const p of data.equipmentPlans) {
      expect(p.plannedFinish >= p.plannedStart).toBe(true);
      expect(p.unitNo).toBeGreaterThanOrEqual(1);
      if (p.workItemId != null) expect(workItemIds.has(p.workItemId)).toBe(true);
    }
    const unitNosOfEquipment1 = new Set(
      data.equipmentPlans.filter((p) => p.equipmentId === 1).map((p) => p.unitNo),
    );
    expect([...unitNosOfEquipment1].sort()).toEqual([1, 2, 3]);
  });
});
