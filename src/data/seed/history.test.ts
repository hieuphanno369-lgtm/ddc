import { describe, expect, it } from 'vitest';
import { buildRepoData, SEED_CURRENT_MONTH, SEED_HISTORY_MONTHS, seedPctPlanDuration } from './history';
import { seedProjects } from './projects';
import { DEFAULT_STAGE_WEIGHTS, validateStageWeights } from '@/lib/stages';
import { valueChainColumns } from '@/lib/value-chain-view';
import { ERP_DETAIL_PROJECT_ID } from './erp';
import { sumManpowerShifts } from '@/lib/shifts';
import { findOverloads } from '@/lib/equipment-plan';

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

  it('8 giai đoạn dimension (P7-C2: them Thanh quyet toan), sortOrder 1..8 không trùng', () => {
    expect(data.stages).toHaveLength(8);
    expect(data.stages.map((s) => s.sortOrder).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('valueChainColumns: cot trai/phai dung 4 ma moi cot', () => {
    const [left, right] = valueChainColumns(data.stages);
    expect(left.map((s) => s.code)).toEqual(['design', 'shop', 'procurement', 'fabrication']);
    expect(right.map((s) => s.code)).toEqual(['transport', 'erection', 'handover', 'settlement']);
  });

  it('mọi dự án có đủ 8 trọng số (7 cu + Thanh quyet toan 0), tổng applicable = 100', () => {
    for (const p of data.projects) {
      const ws = data.stageWeights.filter((w) => w.projectId === p.id);
      expect(ws).toHaveLength(8);
      expect(validateStageWeights(ws).ok).toBe(true);
      const settlement = ws.find((w) => w.stageCode === 'settlement')!;
      expect(settlement).toMatchObject({ weightPct: 0, applicable: true });
    }
  });

  it('data.valueChain khong co dong settlement (khong sinh chuoi cho giai doan trong so 0)', () => {
    expect(data.valueChain.some((v) => v.stageCode === 'settlement')).toBe(false);
  });

  it('trọng số mặc định P7-C2 dung bo da duyet 5/10/10/40/5/25/3/2 (them Thanh quyet toan)', () => {
    expect(DEFAULT_STAGE_WEIGHTS.map((w) => w.weightPct)).toEqual([5, 10, 10, 40, 5, 25, 3, 2]);
    expect(validateStageWeights(DEFAULT_STAGE_WEIGHTS).ok).toBe(true);
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

  it('P3C-A: ke hoach thiet bi theo dot - 7 dong, qty >= 1, unitNo null (nhap theo SL)', () => {
    expect(data.equipmentPlans).toHaveLength(7);
    for (const p of data.equipmentPlans) {
      expect(p.plannedFinish >= p.plannedStart).toBe(true);
      expect(p.qty).toBeGreaterThanOrEqual(1);
      expect(p.unitNo).toBeNull();
    }
  });

  it('P3C-A: moi loai thiet bi >= 2 dot voi >= 2 gia tri qty khac nhau', () => {
    const byEquipment = new Map<number, number[]>();
    for (const p of data.equipmentPlans) {
      const list = byEquipment.get(p.equipmentId) ?? [];
      list.push(p.qty);
      byEquipment.set(p.equipmentId, list);
    }
    for (const [, qtys] of byEquipment) {
      expect(qtys.length).toBeGreaterThanOrEqual(2);
      expect(new Set(qtys).size).toBeGreaterThanOrEqual(2);
    }
  });

  it('P3C-A: co 1 thiet bi khoang thoi gian > 92 ngay (B thay truc thang)', () => {
    const byEquipment = new Map<number, { from: string; to: string }[]>();
    for (const p of data.equipmentPlans) {
      const list = byEquipment.get(p.equipmentId) ?? [];
      list.push({ from: p.plannedStart, to: p.plannedFinish });
      byEquipment.set(p.equipmentId, list);
    }
    const spans = [...byEquipment.values()].map((segs) => {
      const minFrom = segs.map((s) => s.from).reduce((m, s) => (s < m ? s : m));
      const maxTo = segs.map((s) => s.to).reduce((m, s) => (s > m ? s : m));
      return (new Date(maxTo).getTime() - new Date(minFrom).getTime()) / 86_400_000;
    });
    expect(spans.some((d) => d > 92)).toBe(true);
  });

  it('P3C-A: moi loai co dot deu co quota, khong dot nao vuot Tong SL (findOverloads rong)', () => {
    const quotaByEquipment = new Map(data.equipmentQuotas.map((q) => [q.equipmentId, q.totalQty]));
    const segByEquipment = new Map<number, { from: string; to: string; qty: number }[]>();
    for (const p of data.equipmentPlans) {
      const list = segByEquipment.get(p.equipmentId) ?? [];
      list.push({ from: p.plannedStart, to: p.plannedFinish, qty: p.qty });
      segByEquipment.set(p.equipmentId, list);
    }
    for (const [equipmentId, segs] of segByEquipment) {
      const total = quotaByEquipment.get(equipmentId);
      expect(total).toBeGreaterThanOrEqual(1);
      expect(findOverloads(total!, segs)).toEqual([]);
    }
  });

  it('P3C-A: tong moi thang KH nhan luc dung [450,700,800,900,800,650,400]', () => {
    const byMonth = new Map<string, number>();
    for (const m of data.manpowerPlanMonths) {
      byMonth.set(m.yearMonth, (byMonth.get(m.yearMonth) ?? 0) + m.planned);
    }
    const months = [...byMonth.keys()].sort();
    expect(months.map((ym) => byMonth.get(ym))).toEqual([450, 700, 800, 900, 800, 650, 400]);
  });
});
