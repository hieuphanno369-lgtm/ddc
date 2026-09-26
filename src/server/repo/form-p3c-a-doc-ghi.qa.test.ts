import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from './mock-repo';
import type { ManpowerPlanInput } from './types';

/**
 * Kiem thu doc lap (Tester, P3C-A) - dung + thu tu 4 ham doc theo hop dong P3C, va hanh vi ghi:
 * replaceManpowerPlan chi ghi lai audit cho THANG CO DOI, replaceEquipmentPlans dung 1 dong audit
 * "replace". Doc lap voi `form.test.ts`, `prisma-repo-form.test.ts` cua coder.
 */
describe('4 ham doc P3C - dung kieu + thu tu (du an 1, du an 17 rong)', () => {
  beforeEach(() => repo.reset());

  it('readEquipmentPlanSegments(1): 7 dong, sap equipmentId roi from tang dan', async () => {
    const segs = await repo.readEquipmentPlanSegments(1);
    expect(segs).toHaveLength(7);
    for (let i = 1; i < segs.length; i++) {
      const prev = segs[i - 1];
      const cur = segs[i];
      const ok = cur.equipmentId > prev.equipmentId
        || (cur.equipmentId === prev.equipmentId && cur.from >= prev.from);
      expect(ok, `dong ${i - 1}->${i} sai thu tu: ${JSON.stringify(prev)} -> ${JSON.stringify(cur)}`).toBe(true);
    }
    // Dung hop dong: unitNo KHONG con trong kieu tra ve (chi from/to/qty/equipmentName).
    expect(segs[0]).toEqual({ id: expect.any(Number), equipmentId: 1, equipmentName: 'Cẩu bánh xích', from: '2026-07-06', to: '2026-08-30', qty: 1 });
  });

  it('readEquipmentQuotas(1): 3 dong dung {1:3, 2:2, 3:4}, sap equipmentId tang', async () => {
    const quotas = await repo.readEquipmentQuotas(1);
    expect(quotas.map((q) => q.equipmentId)).toEqual([1, 2, 3]);
    expect(quotas.map((q) => q.totalQty)).toEqual([3, 2, 4]);
  });

  it('readManpowerPlanMonths(1): 14 dong (7 thang x 2 ca), sap yearMonth roi sortOrder ca (morning truoc evening)', async () => {
    const months = await repo.readManpowerPlanMonths(1);
    expect(months).toHaveLength(14);
    expect(months[0]).toEqual({ yearMonth: '2026-06', shiftCode: 'morning', planned: 270, isManual: false });
    expect(months[1]).toEqual({ yearMonth: '2026-06', shiftCode: 'evening', planned: 180, isManual: false });
    const totals = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'].map((ym) =>
      months.filter((m) => m.yearMonth === ym).reduce((s, m) => s + m.planned, 0));
    expect(totals).toEqual([450, 700, 800, 900, 800, 650, 400]);
  });

  it('readShiftRatios(1): [{morning,0.6},{evening,0.4}]', async () => {
    expect(await repo.readShiftRatios(1)).toEqual([{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }]);
  });

  it('du an 17 (chua co du lieu P3C): 4 ham deu tra rong / mac dinh', async () => {
    expect(await repo.readEquipmentPlanSegments(17)).toEqual([]);
    expect(await repo.readEquipmentQuotas(17)).toEqual([]);
    expect(await repo.readManpowerPlanMonths(17)).toEqual([]);
    expect(await repo.readShiftRatios(17)).toEqual([{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }]);
  });
});

describe('replaceManpowerPlan - chi ghi audit cho thang CO DOI (K4)', () => {
  beforeEach(() => repo.reset());

  it('gui lai DUNG du lieu dang co -> changedMonths 0, KHONG them dong audit moi', async () => {
    const before = await repo.readManpowerPlanMonths(1);
    const ratios = await repo.readShiftRatios(1);
    const byMonth = new Map<string, { shiftCode: string; planned: number; isManual: boolean }[]>();
    for (const m of before) {
      const list = byMonth.get(m.yearMonth) ?? [];
      list.push({ shiftCode: m.shiftCode, planned: m.planned, isManual: m.isManual });
      byMonth.set(m.yearMonth, list);
    }
    const input: ManpowerPlanInput = {
      ratios,
      months: [...byMonth.entries()].map(([yearMonth, cells]) => ({ yearMonth, cells })),
    };
    const auditBefore = repo.readProjectAuditTrail(1, 500).filter((a) => a.tableName === 'project_manpower_plan_month').length;
    const result = repo.replaceManpowerPlan(1, input, 'tester@qa.local');
    expect(result).toEqual({ changedMonths: 0, ratioChanged: false });
    const auditAfter = repo.readProjectAuditTrail(1, 500).filter((a) => a.tableName === 'project_manpower_plan_month').length;
    expect(auditAfter).toBe(auditBefore);
  });

  it('doi DUNG 1 thang (2026-09) trong 7 thang -> changedMonths=1, CHI 1 dong audit thang moi, 6 thang con lai KHONG doi', async () => {
    const before = await repo.readManpowerPlanMonths(1);
    const ratios = await repo.readShiftRatios(1);
    const byMonth = new Map<string, { shiftCode: string; planned: number; isManual: boolean }[]>();
    for (const m of before) {
      const list = byMonth.get(m.yearMonth) ?? [];
      list.push({ shiftCode: m.shiftCode, planned: m.planned, isManual: m.isManual });
      byMonth.set(m.yearMonth, list);
    }
    byMonth.set('2026-09', [{ shiftCode: 'morning', planned: 600, isManual: true }, { shiftCode: 'evening', planned: 300, isManual: false }]);
    const input: ManpowerPlanInput = { ratios, months: [...byMonth.entries()].map(([yearMonth, cells]) => ({ yearMonth, cells })) };

    const auditBefore = repo.readProjectAuditTrail(1, 500).filter((a) => a.tableName === 'project_manpower_plan_month').length;
    const result = repo.replaceManpowerPlan(1, input, 'tester@qa.local');
    expect(result).toEqual({ changedMonths: 1, ratioChanged: false });

    const after = await repo.readManpowerPlanMonths(1);
    expect(after.find((m) => m.yearMonth === '2026-09' && m.shiftCode === 'morning')).toEqual({ yearMonth: '2026-09', shiftCode: 'morning', planned: 600, isManual: true });
    // 6 thang con lai (12 dong) khong doi so voi truoc.
    const untouched = after.filter((m) => m.yearMonth !== '2026-09');
    const untouchedBefore = before.filter((m) => m.yearMonth !== '2026-09');
    expect(untouched).toEqual(untouchedBefore);

    const auditRows = repo.readProjectAuditTrail(1, 500).filter((a) => a.tableName === 'project_manpower_plan_month');
    expect(auditRows.length).toBe(auditBefore + 1);
    expect(auditRows[0].recordId).toBe('1/2026-09');
    expect(auditRows[0].oldValue).toBe('morning:540,evening:360');
    expect(auditRows[0].newValue).toBe('morning:600(m),evening:300');
  });

  it('doi ty le (0.6/0.4 -> 0.7/0.3) khong dong thang nao -> changedMonths 0 nhung ratioChanged true, co 1 dong audit project_shift_ratio', async () => {
    const before = await repo.readManpowerPlanMonths(1);
    const byMonth = new Map<string, { shiftCode: string; planned: number; isManual: boolean }[]>();
    for (const m of before) {
      const list = byMonth.get(m.yearMonth) ?? [];
      list.push({ shiftCode: m.shiftCode, planned: m.planned, isManual: m.isManual });
      byMonth.set(m.yearMonth, list);
    }
    const input: ManpowerPlanInput = {
      ratios: [{ shiftCode: 'morning', pct: 0.7 }, { shiftCode: 'evening', pct: 0.3 }],
      months: [...byMonth.entries()].map(([yearMonth, cells]) => ({ yearMonth, cells })),
    };
    const result = repo.replaceManpowerPlan(1, input, 'tester@qa.local');
    expect(result).toEqual({ changedMonths: 0, ratioChanged: true });
    const ratioAudit = repo.readProjectAuditTrail(1, 500).filter((a) => a.tableName === 'project_shift_ratio');
    expect(ratioAudit).toHaveLength(1);
    expect(ratioAudit[0].oldValue).toBe('morning:0.6,evening:0.4');
    expect(ratioAudit[0].newValue).toBe('morning:0.7,evening:0.3');
  });

  it('du an 17 (chua co dong ty le) luu DUNG mac dinh 0.6/0.4 -> KHONG ghi audit ty le (bang mac dinh)', async () => {
    const input: ManpowerPlanInput = {
      ratios: [{ shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 }],
      months: [{ yearMonth: '2027-01', cells: [{ shiftCode: 'morning', planned: 60, isManual: false }, { shiftCode: 'evening', planned: 40, isManual: false }] }],
    };
    const result = repo.replaceManpowerPlan(17, input, 'tester@qa.local');
    expect(result.ratioChanged).toBe(false);
    expect(repo.readProjectAuditTrail(17, 500).filter((a) => a.tableName === 'project_shift_ratio')).toHaveLength(0);
    // Nhung thang moi van duoc ghi (audit old = '').
    const monthAudit = repo.readProjectAuditTrail(17, 500).filter((a) => a.tableName === 'project_manpower_plan_month');
    expect(monthAudit[0].oldValue).toBe('');
  });
});

describe('replaceEquipmentPlans - 1 dong audit "replace" cho ca kh thiet bi', () => {
  beforeEach(() => repo.reset());

  it('luu 2 nhom (1 nhom 0 dot) -> quota + segments dung, 1 dong audit replace chua chu "tong"', async () => {
    const groups = [
      { equipmentId: 4, totalQty: 3, segments: [{ from: '2027-01-01', to: '2027-01-10', qty: 2 }] },
      { equipmentId: 5, totalQty: 1, segments: [] as { from: string; to: string; qty: number }[] },
    ];
    repo.replaceEquipmentPlans(1, groups, 'tester@qa.local');
    const quotas = await repo.readEquipmentQuotas(1);
    expect(quotas).toEqual([
      { equipmentId: 4, equipmentName: expect.any(String), totalQty: 3 },
      { equipmentId: 5, equipmentName: expect.any(String), totalQty: 1 },
    ]);
    const segs = await repo.readEquipmentPlanSegments(1);
    expect(segs).toEqual([{ id: expect.any(Number), equipmentId: 4, equipmentName: expect.any(String), from: '2027-01-01', to: '2027-01-10', qty: 2 }]);
    const audit = repo.readProjectAuditTrail(1, 500).filter((a) => a.tableName === 'project_equipment_plan');
    expect(audit[0].field).toBe('replace');
    expect(audit[0].newValue).toContain('tong');
  });

  it('luu mang RONG -> xoa sach kh thiet bi cua DU AN DO, du an khac khong doi', async () => {
    const before17 = await repo.readEquipmentQuotas(17);
    repo.replaceEquipmentPlans(1, [], 'tester@qa.local');
    expect(await repo.readEquipmentQuotas(1)).toEqual([]);
    expect(await repo.readEquipmentPlanSegments(1)).toEqual([]);
    expect(await repo.readEquipmentQuotas(17)).toEqual(before17);
  });
});
