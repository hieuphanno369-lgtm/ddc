import { beforeEach, describe, expect, it } from 'vitest';
import type { RepoData } from '@/data/seed/history';
import { repo } from './mock-repo';
import { makeEntryMockRepo } from './mock-repo-entry';
import type { NewEngineAlert, Project, ProjectStageWeight, Stage } from './types';

/** Task 1 (P2A) - getShifts/getDailyManpowerByShift + logAudit/closeAlert nhận thêm note. */
describe('entry repo (mock)', () => {
  beforeEach(() => {
    repo.reset();
  });

  it('getShifts tra dung 2 ma theo thu tu morning, evening', () => {
    const shifts = repo.getShifts();
    expect(shifts.map((s) => s.code)).toEqual(['morning', 'evening']);
    expect(shifts.find((s) => s.code === 'evening')!.nameVi).toBe('Ca tối');
  });

  it('getDailyManpowerByShift ngay cuoi seed co 12 dong, tong KH 520 / TT 486', () => {
    const rows = repo.getDailyManpowerByShift(1, '2026-09-16', '2026-09-16');
    expect(rows).toHaveLength(12);
    expect(rows.reduce((a, b) => a + b.plannedHeadcount, 0)).toBe(520);
    expect(rows.reduce((a, b) => a + b.actualHeadcount, 0)).toBe(486);
  });

  it('closeAlert ghi closedBy + closeNote', () => {
    const alert = repo.getAlerts()[0];
    repo.closeAlert(alert.id, 'X', 'u@x', 'ghi chú');
    const after = repo.getAlerts().find((a) => a.id === alert.id)!;
    expect(after.closedBy).toBe('u@x');
    expect(after.closeNote).toBe('ghi chú');
  });

  it('logAudit ghi note', () => {
    repo.logAudit('demo_table', '1', 'field', 'old', 'new', 'u@x', 'lý do');
    const last = repo.getAuditLog()[0];
    expect(last.note).toBe('lý do');
  });

  it('addProjectContractor lan 2 -> exists', () => {
    expect(repo.addProjectContractor(2, 1, 'u@x')).toBe('added');
    expect(repo.addProjectContractor(2, 1, 'u@x')).toBe('exists');
  });

  it('nha thau khong ton tai -> not_found', () => {
    expect(repo.addProjectContractor(2, 999999, 'u@x')).toBe('not_found');
  });

  it('moi add/remove co 1 dong audit project_contractor', () => {
    const before = repo.getAuditLog().length;
    repo.addProjectContractor(3, 1, 'u@x');
    const afterAdd = repo.getAuditLog();
    expect(afterAdd.length).toBe(before + 1);
    expect(afterAdd[0].tableName).toBe('project_contractor');

    repo.removeProjectContractor(3, 1, 'u@x');
    const afterRemove = repo.getAuditLog();
    expect(afterRemove.length).toBe(before + 2);
    expect(afterRemove[0].tableName).toBe('project_contractor');
  });

  it('saveDailyResources: o moi 0/0 khong tao dong', () => {
    const res = repo.saveDailyResources(2, '2026-09-16', {
      manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 0, actualHeadcount: 0 }],
      equipment: [],
    }, 'u@x', '');
    expect(res).toEqual({ created: 0, updated: 0, unchanged: 1 });
    expect(repo.getDailyManpowerByShift(2, '2026-09-16', '2026-09-16')).toHaveLength(0);
  });

  it('saveDailyResources: o moi 5/4 tao', () => {
    const res = repo.saveDailyResources(2, '2026-09-16', {
      manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 }],
      equipment: [],
    }, 'u@x', '');
    expect(res).toEqual({ created: 1, updated: 0, unchanged: 0 });
  });

  it('saveDailyResources: doi o co san -> 1 audit co note; gui y het -> unchanged khong audit', () => {
    const before = repo.getAuditLog().length;
    const res1 = repo.saveDailyResources(1, '2026-09-16', {
      manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 999, actualHeadcount: 999 }],
      equipment: [],
    }, 'u@x', 'ly do sua');
    expect(res1).toEqual({ created: 0, updated: 1, unchanged: 0 });
    const afterFirst = repo.getAuditLog();
    expect(afterFirst.length).toBe(before + 1);
    expect(afterFirst[0].note).toBe('ly do sua');

    const res2 = repo.saveDailyResources(1, '2026-09-16', {
      manpower: [{ contractorId: 1, shiftCode: 'morning', plannedHeadcount: 999, actualHeadcount: 999 }],
      equipment: [],
    }, 'u@x', '');
    expect(res2).toEqual({ created: 0, updated: 0, unchanged: 1 });
    expect(repo.getAuditLog().length).toBe(before + 1);
  });

  it('tong qua getDailyManpower = tong cac ca', () => {
    repo.saveDailyResources(2, '2026-09-16', {
      manpower: [
        { contractorId: 1, shiftCode: 'morning', plannedHeadcount: 5, actualHeadcount: 4 },
        { contractorId: 1, shiftCode: 'evening', plannedHeadcount: 3, actualHeadcount: 2 },
      ],
      equipment: [],
    }, 'u@x', '');
    const totals = repo.getDailyManpower(2, '2026-09-16', '2026-09-16');
    expect(totals).toEqual([{ projectId: 2, contractorId: 1, workDate: '2026-09-16', plannedHeadcount: 8, actualHeadcount: 6 }]);
  });

  it('saveVolume: created -> updated -> unchanged, audit 2 dong', () => {
    const before = repo.getAuditLog().length;

    expect(repo.saveVolume(2, '2026-09', 1, 100, 'u@x')).toBe('created');
    expect(repo.saveVolume(2, '2026-09', 1, 150, 'u@x')).toBe('updated');
    expect(repo.saveVolume(2, '2026-09', 1, 150, 'u@x')).toBe('unchanged');

    expect(repo.getVolumes(2, '2026-09').find((v) => v.factoryId === 1)?.tonnageProcessed).toBe(150);
    const newAudits = repo.getAuditLog().slice(0, repo.getAuditLog().length - before);
    expect(newAudits.filter((a) => a.tableName === 'fact_volume')).toHaveLength(2);
  });

  it('saveFactory: trung ten -> duplicate_name; id khong co -> not_found', () => {
    expect(repo.saveFactory({ name: 'nhà máy đồng nai', region: '', capacityTonPerYear: 1 }, 'u@x')).toBe('duplicate_name');
    expect(repo.saveFactory({ id: 999999, name: 'X', region: '', capacityTonPerYear: 1 }, 'u@x')).toBe('not_found');
  });

  it('setFactoryActive: id khong co -> false', () => {
    expect(repo.setFactoryActive(999999, false, 'u@x')).toBe(false);
  });

  /** T11 (Task 8, P2A): insertEngineAlerts - test truc tiep tren repo, khong qua engine. */
  describe('insertEngineAlerts (K6 - chong trung)', () => {
    function candidate(over: Partial<NewEngineAlert> = {}): NewEngineAlert {
      return {
        projectId: 4, ruleCode: 'spi_low', alertType: 'Amber', ruleTriggered: 'SPI < 0.9',
        message: 'SPI = 0.80 - trễ tiến độ theo giá trị', dedupeKey: 'spi_low:2026-09',
        owner: 'pm@daidung.com.vn', deadline: '2026-09-30', openedAt: '2026-09-16T00:00:00.000Z',
        ...over,
      };
    }

    it('duong chay thuan loi: du an chua co alert cung dedupeKey -> tao moi, tra ve 1', () => {
      const before = repo.getAlerts().length;
      const created = repo.insertEngineAlerts([candidate()]);
      expect(created).toBe(1);
      expect(repo.getAlerts()).toHaveLength(before + 1);
      const row = repo.getAlerts().find((a) => a.projectId === 4 && a.ruleCode === 'spi_low');
      expect(row).toMatchObject({ dedupeKey: 'spi_low:2026-09', closedAt: null, action: '', closedBy: null, closeNote: '' });
    });

    it('bien: cung (projectId, dedupeKey) da co (du da dong) -> khong tao lai, tra ve 0', () => {
      repo.insertEngineAlerts([candidate()]);
      repo.closeAlert(repo.getAlerts().find((a) => a.projectId === 4 && a.ruleCode === 'spi_low')!.id, 'Đã xử lý', 'admin@daidung.com.vn', '');
      const before = repo.getAlerts().length;

      const created = repo.insertEngineAlerts([candidate()]);

      expect(created).toBe(0);
      expect(repo.getAlerts()).toHaveLength(before);
    });

    it('bien: dedupeKey khac nhung con alert MO cung ruleCode -> khong tao (chan trung luat dang mo)', () => {
      repo.insertEngineAlerts([candidate()]); // mo alert spi_low:2026-09, van dang mo
      const before = repo.getAlerts().length;

      const created = repo.insertEngineAlerts([candidate({ dedupeKey: 'spi_low:2026-10' })]);

      expect(created).toBe(0);
      expect(repo.getAlerts()).toHaveLength(before);
    });

    it('dedupeKey khac VA alert cu cung ruleCode DA DONG -> duoc tao (Q10: khong tu mo lai nhung ky moi van tao)', () => {
      repo.insertEngineAlerts([candidate()]);
      repo.closeAlert(repo.getAlerts().find((a) => a.projectId === 4 && a.ruleCode === 'spi_low')!.id, 'Đã xử lý', 'admin@daidung.com.vn', '');

      const created = repo.insertEngineAlerts([candidate({ dedupeKey: 'spi_low:2026-10' })]);

      expect(created).toBe(1);
      expect(repo.getAlerts().filter((a) => a.projectId === 4 && a.ruleCode === 'spi_low')).toHaveLength(2);
    });

    it('mang rong -> tra ve 0, khong doi gi', () => {
      const before = repo.getAlerts().length;
      expect(repo.insertEngineAlerts([])).toBe(0);
      expect(repo.getAlerts()).toHaveLength(before);
    });
  });
});

/** P7-C2 Task 8: saveStage/setStageActive (mock) tren du lieu tu dung. */
describe('entry repo (mock) - quan tri giai doan', () => {
  const stage = (code: string, sortOrder: number, isActive = true): Stage =>
    ({ code, nameVi: `GĐ ${code}`, nameEn: `Stage ${code}`, sortOrder, calcMode: 'manual', side: 'left', isActive });
  function make(stages: Stage[], stageWeights: ProjectStageWeight[] = [], projectIds: number[] = [1, 2]) {
    const data = {
      stages, stageWeights, auditLog: [],
      projects: projectIds.map((id) => ({ id }) as Project),
    } as unknown as RepoData;
    return { data, r: makeEntryMockRepo({ getData: () => data, persist: () => {} }) };
  }
  const input = { nameVi: 'Mới', nameEn: 'New', side: 'right' as const, sortOrder: 3, calcMode: 'volume' as const };

  it('saveStage sua code khong co -> not_found', () => {
    const { r } = make([stage('design', 1)]);
    expect(r.saveStage({ ...input, code: 'custom_7' }, 'u@x')).toBe('not_found');
  });

  it('saveStage tao moi khi da du 30 giai doan (tinh ca ngung dung) -> too_many', () => {
    const stages = Array.from({ length: 30 }, (_, i) => stage(`custom_${i + 1}`, i + 1, i % 2 === 0));
    const { r, data } = make(stages);
    expect(r.saveStage(input, 'u@x')).toBe('too_many');
    expect(data.stages).toHaveLength(30);
  });

  it('saveStage tao moi -> ma custom_<max+1>, chen trong so 0% cho du an da co dong trong so', () => {
    const { r, data } = make(
      [stage('design', 1), stage('custom_4', 2)],
      [{ projectId: 1, stageCode: 'design', weightPct: 100, applicable: true }],
    );
    const res = r.saveStage(input, 'u@x');
    expect(res).toMatchObject({ code: 'custom_5', side: 'right', calcMode: 'volume', isActive: true });
    expect(data.stageWeights.filter((w) => w.stageCode === 'custom_5')).toEqual([
      { projectId: 1, stageCode: 'custom_5', weightPct: 0, applicable: true },
    ]);
  });

  it('setStageActive tat giai doan dang dung cuoi cung -> last_active', () => {
    const { r, data } = make([stage('design', 1), stage('shop', 2, false)]);
    expect(r.setStageActive('design', false, 'u@x')).toBe('last_active');
    expect(data.stages[0].isActive).toBe(true);
  });

  it('setStageActive dem in_use chi tinh dong applicable va weightPct > 0', () => {
    const { r } = make([stage('design', 1), stage('shop', 2)], [
      { projectId: 1, stageCode: 'shop', weightPct: 10, applicable: true },
      { projectId: 2, stageCode: 'shop', weightPct: 10, applicable: false },
    ]);
    expect(r.setStageActive('shop', false, 'u@x')).toEqual({ status: 'in_use', count: 1 });
  });
});
