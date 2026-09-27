import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from './mock-repo';
import { todayIso } from '@/lib/clock';

beforeEach(() => repo.reset());

describe('changeProjectCode (mock-repo)', () => {
  it('du an 1 dang co alias mo -> dong lai hom nay, mo dong moi tu mai', () => {
    const before = repo.getAliases(1);
    const openBefore = before.find((a) => a.effectiveTo == null)!;
    const res = repo.changeProjectCode(1, 'CT-MOI-1', 'doi theo yeu cau CDT', 'admin@x', todayIso());
    expect(res).toBe('changed');
    const after = repo.getAliases(1);
    const closed = after.find((a) => a.id === openBefore.id)!;
    expect(closed.effectiveTo).toBe('2026-09-16');
    const opened = after.find((a) => a.aliasCode === 'CT-MOI-1')!;
    expect(opened.effectiveFrom).toBe('2026-09-17');
    expect(opened.effectiveTo).toBeNull();
    expect(repo.getProject(1)!.currentAliasCode).toBe('CT-MOI-1');
  });

  it('doi lan 2 trong cung ngay -> so dong alias khong tang', () => {
    repo.changeProjectCode(1, 'CT-MOI-1', 'ly do 1', 'admin@x', todayIso());
    const countAfterFirst = repo.getAliases(1).length;
    const res = repo.changeProjectCode(1, 'CT-MOI-2', 'ly do 2', 'admin@x', todayIso());
    expect(res).toBe('changed');
    expect(repo.getAliases(1).length).toBe(countAfterFirst);
    expect(repo.getAliases(1).find((a) => a.aliasCode === 'CT-MOI-2')).toBeTruthy();
  });

  it('du an moi tao (chua co dong alias nao) -> co insertOld + insertNew', () => {
    const created = repo.createProject({
      projectName: 'DU AN TEST KHONG ALIAS', customerId: 1, teamKdId: 1, marketCode: 'NoiBo',
      projectType: 'Khac', priority: 'P2', contractValue: 10, tonnage: 100,
      plannedStartDate: '2026-10-01', plannedFinishDate: '2027-06-30', committedHandoverDate: '2027-07-31',
    }, 'admin@x');
    expect(repo.getAliases(created.id)).toEqual([]);
    const res = repo.changeProjectCode(created.id, 'CT-KHONG-ALIAS', 'khoi tao mã CT', 'admin@x', todayIso());
    expect(res).toBe('changed');
    const rows = repo.getAliases(created.id);
    expect(rows).toHaveLength(2);
    expect(rows.find((a) => a.aliasCode === created.masterCode)?.effectiveTo).toBe(todayIso());
    expect(rows.find((a) => a.aliasCode === 'CT-KHONG-ALIAS')?.effectiveFrom).toBe('2026-09-17');
  });

  it('du an tao voi currentAliasCode -> dong luc tao dung todayIso(), doi ma dong dung khong mat lich su', () => {
    const created = repo.createProject({
      projectName: 'DU AN TEST ALIAS LUC TAO', customerId: 1, teamKdId: 1, marketCode: 'NoiBo',
      projectType: 'Khac', priority: 'P2', contractValue: 10, tonnage: 100,
      plannedStartDate: '2026-10-01', plannedFinishDate: '2027-06-30', committedHandoverDate: '2027-07-31',
      currentAliasCode: 'CT-TAO-1',
    }, 'admin@x');
    const createdAlias = repo.getAliases(created.id).find((a) => a.aliasCode === 'CT-TAO-1')!;
    expect(createdAlias.effectiveFrom).toBe('2026-09-16');
    const res = repo.changeProjectCode(created.id, 'CT-TAO-2', 'doi ma sau khi tao', 'admin@x', todayIso());
    expect(res).toBe('changed');
    const rows = repo.getAliases(created.id);
    expect(rows).toHaveLength(2);
    const old = rows.find((a) => a.aliasCode === 'CT-TAO-1')!;
    expect(old.effectiveFrom).toBe('2026-09-16');
    expect(old.effectiveTo).toBe('2026-09-16');
    const next = rows.find((a) => a.aliasCode === 'CT-TAO-2')!;
    expect(next.effectiveFrom).toBe('2026-09-17');
  });

  it('khong ton tai du an -> not_found', () => {
    expect(repo.changeProjectCode(99999, 'X', 'ly do', 'admin@x', todayIso())).toBe('not_found');
  });

  it('ma khong doi -> unchanged', () => {
    const p = repo.getProject(1)!;
    expect(repo.changeProjectCode(1, p.currentAliasCode, 'ly do', 'admin@x', todayIso())).toBe('unchanged');
  });

  it('ghi project_history voi note dang "currentAliasCode: A -> B"', () => {
    const old = repo.getProject(1)!.currentAliasCode;
    repo.changeProjectCode(1, 'CT-MOI-9', 'ly do', 'admin@x', todayIso());
    const hist = repo.getProjectHistory().find((h) => h.note.includes('currentAliasCode'));
    expect(hist?.note).toBe(`currentAliasCode: ${old} → CT-MOI-9`);
  });

  it('S-2 (vong sua 1): doi sang ma da la currentAliasCode cua du an khac -> "taken"', () => {
    const p2 = repo.getProject(2)!;
    const res = repo.changeProjectCode(1, p2.currentAliasCode, 'ly do', 'admin@x', todayIso());
    expect(res).toBe('taken');
    expect(repo.getProject(1)!.currentAliasCode).not.toBe(p2.currentAliasCode);
  });
});

describe('isProjectCodeTaken (mock-repo)', () => {
  it('ma cua du an khac -> true', () => {
    const p2 = repo.getProject(2)!;
    expect(repo.isProjectCodeTaken(p2.currentAliasCode, 1)).toBe(true);
  });

  it('ma cu cua chinh no -> false', () => {
    const p1 = repo.getProject(1)!;
    expect(repo.isProjectCodeTaken(p1.currentAliasCode, 1)).toBe(false);
  });

  it('ma chua ton tai -> false', () => {
    expect(repo.isProjectCodeTaken('MA-HOAN-TOAN-MOI-XYZ', null)).toBe(false);
  });
});

describe('replaceStageWeights (mock-repo)', () => {
  it('thay toan bo 8 dong (du 8 ma dang gui), doc lai dung nhu vua gui', () => {
    const rows = [
      { stageCode: 'design' as const, weightPct: 10, applicable: true },
      { stageCode: 'shop' as const, weightPct: 10, applicable: true },
      { stageCode: 'procurement' as const, weightPct: 10, applicable: true },
      { stageCode: 'fabrication' as const, weightPct: 40, applicable: true },
      { stageCode: 'transport' as const, weightPct: 5, applicable: true },
      { stageCode: 'erection' as const, weightPct: 22, applicable: true },
      { stageCode: 'handover' as const, weightPct: 3, applicable: true },
      { stageCode: 'settlement' as const, weightPct: 0, applicable: true },
    ];
    repo.replaceStageWeights(1, rows, 'admin@x');
    const saved = repo.getStageWeights(1);
    expect(saved).toHaveLength(8);
    expect(saved.find((w) => w.stageCode === 'fabrication')?.weightPct).toBe(40);
  });

  // T-4 (vong sua bao mat): ma KHONG nam trong rows gui len (vi du giai doan da ngung dung, form
  // khong hien thi) phai duoc GIU NGUYEN, khong bi xoa theo cac ma con lai.
  it('T-4: ma khong nam trong rows gui len duoc giu nguyen, khong bi xoa', () => {
    const before = repo.getStageWeights(1).find((w) => w.stageCode === 'settlement');
    expect(before).toBeTruthy();
    repo.replaceStageWeights(1, [
      { stageCode: 'design', weightPct: 100, applicable: true },
      { stageCode: 'shop', weightPct: 0, applicable: false },
      { stageCode: 'procurement', weightPct: 0, applicable: false },
      { stageCode: 'fabrication', weightPct: 0, applicable: false },
      { stageCode: 'transport', weightPct: 0, applicable: false },
      { stageCode: 'erection', weightPct: 0, applicable: false },
      { stageCode: 'handover', weightPct: 0, applicable: false },
      // KHONG gui 'settlement' - mo phong giai doan da ngung dung, form khong hien thi
    ], 'admin@x');
    const after = repo.getStageWeights(1).find((w) => w.stageCode === 'settlement');
    expect(after).toEqual(before);
  });

  it('du an seed da co dong rieng -> audit KHONG co tien to "default "', () => {
    repo.replaceStageWeights(1, [
      { stageCode: 'design', weightPct: 100, applicable: true },
      { stageCode: 'shop', weightPct: 0, applicable: false },
      { stageCode: 'procurement', weightPct: 0, applicable: false },
      { stageCode: 'fabrication', weightPct: 0, applicable: false },
      { stageCode: 'transport', weightPct: 0, applicable: false },
      { stageCode: 'erection', weightPct: 0, applicable: false },
      { stageCode: 'handover', weightPct: 0, applicable: false },
    ], 'admin@x');
    const entry = repo.getAuditLog().find((a) => a.tableName === 'project_stage_weight');
    expect(entry?.oldValue.startsWith('default ')).toBe(false);
    expect(entry?.newValue).toContain('shop:0(x)');
  });

  it('du an moi tao (chua co dong rieng) -> audit co tien to "default "', () => {
    const created = repo.createProject({
      projectName: 'DU AN TEST TRONG SO', customerId: 1, teamKdId: 1, marketCode: 'NoiBo',
      projectType: 'Khac', priority: 'P2', contractValue: 10, tonnage: 100,
      plannedStartDate: '2026-10-01', plannedFinishDate: '2027-06-30', committedHandoverDate: '2027-07-31',
    }, 'admin@x');
    repo.replaceStageWeights(created.id, [
      { stageCode: 'design', weightPct: 100, applicable: true },
      { stageCode: 'shop', weightPct: 0, applicable: false },
      { stageCode: 'procurement', weightPct: 0, applicable: false },
      { stageCode: 'fabrication', weightPct: 0, applicable: false },
      { stageCode: 'transport', weightPct: 0, applicable: false },
      { stageCode: 'erection', weightPct: 0, applicable: false },
      { stageCode: 'handover', weightPct: 0, applicable: false },
    ], 'admin@x');
    const entry = repo.getAuditLog().filter((a) => a.tableName === 'project_stage_weight').pop();
    expect(entry?.oldValue.startsWith('default ')).toBe(true);
  });
});

describe('removeSapCode (mock-repo)', () => {
  it('id thuoc du an khac -> not_found, ma van con', () => {
    const sapOfOther = repo.getSapCodes().find((s) => s.projectId !== 1);
    expect(sapOfOther).toBeTruthy();
    const res = repo.removeSapCode(1, sapOfOther!.id, 'admin@x');
    expect(res).toBe('not_found');
    expect(repo.getSapCodes().some((s) => s.id === sapOfOther!.id)).toBe(true);
  });

  it('id dung du an -> removed', () => {
    const sap = repo.getSapCodes(1)[0];
    if (!sap) return; // du an mau khong co SAP thi bo qua ca nay
    expect(repo.removeSapCode(1, sap.id, 'admin@x')).toBe('removed');
    expect(repo.getSapCodes(1).some((s) => s.id === sap.id)).toBe(false);
  });
});

// Du an 16 khong nam trong pmOwns/viewerSees cua seed (buildAssignments) -> PIC mac dinh la
// admin@daidung.com.vn, chua co Backup. Dung du an nay de them thanh vien moi khong dung seed co san.
describe('getProjectMembers / setProjectMember / removeProjectMember (mock-repo)', () => {
  it('setProjectMember them moi -> "added", doc lai dung vai tro', () => {
    const res = repo.setProjectMember(16, 'pm@daidung.com.vn', 'Backup', 'admin@x');
    expect(res).toBe('added');
    const members = repo.getProjectMembers(16);
    expect(members.find((m) => m.userEmail === 'pm@daidung.com.vn')).toMatchObject({ roleInProject: 'Backup' });
  });

  it('cung vai tro (PIC san co cua seed) -> "unchanged", khong ghi audit moi', () => {
    const auditCountBefore = repo.getAuditLog().length;
    const res = repo.setProjectMember(16, 'admin@daidung.com.vn', 'PIC', 'admin@x');
    expect(res).toBe('unchanged');
    expect(repo.getAuditLog().length).toBe(auditCountBefore);
  });

  it('PIC dung dau danh sach du email xep sau theo bang chu cai', () => {
    repo.setProjectMember(16, 'aaa-nguoi-moi@daidung.com.vn', 'Backup', 'admin@x');
    const members = repo.getProjectMembers(16);
    expect(members[0]).toMatchObject({ userEmail: 'admin@daidung.com.vn', roleInProject: 'PIC' });
  });

  it('removeProjectMember - khong phai thanh vien -> not_member', () => {
    expect(repo.removeProjectMember(16, 'khong-ton-tai@daidung.com.vn', 'admin@x')).toBe('not_member');
  });

  it('removeProjectMember - dung thanh vien -> removed', () => {
    repo.setProjectMember(16, 'pm@daidung.com.vn', 'Backup', 'admin@x');
    expect(repo.removeProjectMember(16, 'pm@daidung.com.vn', 'admin@x')).toBe('removed');
    expect(repo.getProjectMembers(16).some((m) => m.userEmail === 'pm@daidung.com.vn')).toBe(false);
  });

  // Vòng sửa 1 (QĐ-11, S-6): trước đây mock KHÔNG chặn PIC trùng (luật nằm ở action) - đổi ý định
  // có chủ đích, nay mock cũng tự kiểm và trả 'pic_exists' (đồng bộ với Prisma + partial unique index).
  it('pic trung -> "pic_exists" (S-6, mock tu kiem, khong con "them duoc roi de action chan")', () => {
    const res = repo.setProjectMember(16, 'viewer@daidung.com.vn', 'PIC', 'admin@x');
    expect(res).toBe('pic_exists');
    expect(repo.getProjectMembers(16).filter((m) => m.roleInProject === 'PIC')).toHaveLength(1);
  });
});

describe('approveCustomer (mock-repo)', () => {
  it('dang cho duyet -> approved, needsReview ve false', () => {
    const id = repo.createDimValue('customer', 'CDT MOI CHO DUYET', { needsReview: true, by: 'pm@daidung.com.vn' });
    expect(repo.approveCustomer(id, 'admin@x')).toBe('approved');
  });

  it('khong ton tai -> not_found', () => {
    expect(repo.approveCustomer(999999, 'admin@x')).toBe('not_found');
  });

  it('da duyet roi -> not_pending', () => {
    expect(repo.approveCustomer(1, 'admin@x')).toBe('not_pending');
  });
});

describe('readProjectAuditTrail (mock-repo)', () => {
  it('khong tra dong cua du an 11 khi hoi du an 1 (tranh khop nham tien to "1/")', () => {
    repo.setProjectMember(1, 'moi-1@daidung.com.vn', 'Backup', 'admin@x');
    repo.setProjectMember(11, 'moi-1@daidung.com.vn', 'Backup', 'admin@x');
    const rows = repo.readProjectAuditTrail(1, 50);
    expect(rows.every((r) => !r.recordId.startsWith('11/'))).toBe(true);
    expect(rows.some((r) => r.recordId === '1/moi-1@daidung.com.vn')).toBe(true);
  });

  it('gioi han limit', () => {
    for (let i = 0; i < 5; i++) repo.replaceStageWeights(1, repo.getStageWeights(1), `admin${i}@x`);
    expect(repo.readProjectAuditTrail(1, 2)).toHaveLength(2);
  });
});

describe('P3C-A: 4 ham doc hop dong (mock-repo)', () => {
  it('readEquipmentPlanSegments(1): 7 dong dung thu tu, equipmentName dung', async () => {
    const rows = await repo.readEquipmentPlanSegments(1);
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => [r.equipmentId, r.from, r.to, r.qty])).toEqual([
      [1, '2026-07-06', '2026-08-30', 1],
      [1, '2026-08-31', '2026-10-25', 3],
      [1, '2026-10-26', '2026-11-29', 2],
      [2, '2026-08-17', '2026-09-20', 2],
      [2, '2026-09-21', '2026-10-25', 1],
      [3, '2026-09-01', '2026-09-30', 3],
      [3, '2026-09-15', '2026-10-31', 1],
    ]);
    expect(rows.find((r) => r.equipmentId === 1)?.equipmentName).toBe('Cẩu bánh xích');
  });

  it('readEquipmentQuotas(1): 3 dong', async () => {
    const rows = await repo.readEquipmentQuotas(1);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => [r.equipmentId, r.totalQty])).toEqual([[1, 3], [2, 2], [3, 4]]);
  });

  it('readManpowerPlanMonths(1): 14 dong, dong dau morning 270, dong 2 evening 180', async () => {
    const rows = await repo.readManpowerPlanMonths(1);
    expect(rows).toHaveLength(14);
    expect(rows[0]).toEqual({ yearMonth: '2026-06', shiftCode: 'morning', planned: 270, isManual: false });
    expect(rows[1]).toEqual({ yearMonth: '2026-06', shiftCode: 'evening', planned: 180, isManual: false });
  });

  it('readShiftRatios(1): 60/40', async () => {
    expect(await repo.readShiftRatios(1)).toEqual([
      { shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 },
    ]);
  });

  it('du an 17 (khong co seed T4/T5): segments/quotas/months rong, ratios = mac dinh 60/40', async () => {
    expect(await repo.readEquipmentPlanSegments(17)).toEqual([]);
    expect(await repo.readEquipmentQuotas(17)).toEqual([]);
    expect(await repo.readManpowerPlanMonths(17)).toEqual([]);
    expect(await repo.readShiftRatios(17)).toEqual([
      { shiftCode: 'morning', pct: 0.6 }, { shiftCode: 'evening', pct: 0.4 },
    ]);
  });
});
