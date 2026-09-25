import { describe, expect, it } from 'vitest';
import type { Project, ValueChainProgress } from '@/server/repo/types';
import { STAGE_ORDER } from '@/lib/stages';
import { repo } from '@/server/repo/mock-repo';
import {
  buildBaseForm,
  buildSavePatch,
  checkDraft,
  DRAFT_VERSION,
  draftFieldsEqual,
  formsEqual,
  restoreDraft,
  saveErrorKind,
  toDateInput,
  toDraftForm,
  type DraftStamp,
  type FormState,
  type StoredDraft,
} from './dataEntryState';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    masterCode: 'M-00001',
    currentAliasCode: '10626-008',
    projectName: 'Du an mau',
    customerId: 1,
    teamKdId: 1,
    marketCode: 'TN',
    projectType: 'EPC',
    priority: 'P1',
    contractValue: 100,
    tonnage: 500,
    currencyCode: 'VND',
    contractDate: null,
    plannedStartDate: null,
    plannedFinishDate: null,
    committedHandoverDate: null,
    actualStartDate: null,
    actualFinishDate: null,
    penaltyValue: null,
    penalized: false,
    isActive: true,
    factoryId: null,
    contractValueOriginal: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedBy: 'system',
    ...overrides,
  };
}

describe('toDateInput', () => {
  it('ISO co gio -> lay 10 ky tu dau', () => {
    expect(toDateInput('2026-01-15T00:00:00.000Z')).toBe('2026-01-15');
  });
  it('da la YYYY-MM-DD -> giu nguyen', () => {
    expect(toDateInput('2026-01-15')).toBe('2026-01-15');
  });
  it.each([null, undefined, '', 'abc'])('%s -> rong', (v) => {
    expect(toDateInput(v)).toBe('');
  });
});

describe('buildBaseForm', () => {
  it('du an co ngay ISO -> 6 o dang YYYY-MM-DD', () => {
    const project = makeProject({
      contractDate: '2025-11-20T00:00:00.000Z',
      plannedStartDate: '2025-12-15T00:00:00.000Z',
      plannedFinishDate: '2026-09-29T00:00:00.000Z',
      committedHandoverDate: '2026-09-29T00:00:00.000Z',
      actualStartDate: '2025-12-15T00:00:00.000Z',
      actualFinishDate: '2026-09-30T00:00:00.000Z',
    });
    const base = buildBaseForm(project, undefined, undefined, []);
    expect(base.contractDate).toBe('2025-11-20');
    expect(base.plannedStartDate).toBe('2025-12-15');
    expect(base.plannedFinishDate).toBe('2026-09-29');
    expect(base.committedHandoverDate).toBe('2026-09-29');
    expect(base.actualStartDate).toBe('2025-12-15');
    expect(base.actualFinishDate).toBe('2026-09-30');
  });

  it('du an tao moi qua repo.createProject (mock-repo) khong ngay -> 6 o rong', () => {
    repo.reset();
    const created = repo.createProject({
      projectName: 'Du an moi', customerId: 1, teamKdId: 1, marketCode: 'TN',
      projectType: 'EPC', priority: 'P1', contractValue: 100,
    });
    const base = buildBaseForm(created, undefined, undefined, []);
    expect(base.contractDate).toBe('');
    expect(base.plannedStartDate).toBe('');
    expect(base.plannedFinishDate).toBe('');
    expect(base.committedHandoverDate).toBe('');
    expect(base.actualStartDate).toBe('');
    expect(base.actualFinishDate).toBe('');
  });

  it('moi field tao moi khop String(input)', () => {
    repo.reset();
    const created = repo.createProject({
      projectName: 'Du an ABC', customerId: 2, teamKdId: 3, marketCode: 'XK',
      projectType: 'Cau_cang', priority: 'P2', contractValue: 250.5, tonnage: 999,
      currencyCode: 'USD',
    });
    const base = buildBaseForm(created, undefined, undefined, []);
    expect(base.projectName).toBe('Du an ABC');
    expect(base.customerId).toBe(String(created.customerId));
    expect(base.teamKdId).toBe(String(created.teamKdId));
    expect(base.marketCode).toBe('XK');
    expect(base.projectType).toBe('Cau_cang');
    expect(base.priority).toBe('P2');
    expect(base.contractValue).toBe(String(created.contractValue));
    expect(base.tonnage).toBe(String(created.tonnage));
    expect(base.currencyCode).toBe('USD');
  });

  it('co factoryId cua du an + volumeTonnage tu tham so', () => {
    const project = makeProject({ factoryId: 2 });
    const base = buildBaseForm(project, undefined, undefined, [], 120);
    expect(base.factoryId).toBe('2');
    expect(base.volumeTonnage).toBe('120');
  });

  it('khong co factory / volume -> o rong', () => {
    const base = buildBaseForm(makeProject({ factoryId: null }), undefined, undefined, []);
    expect(base.factoryId).toBe('');
    expect(base.volumeTonnage).toBe('');
  });
});

const EMPTY_CHAIN: ValueChainProgress[] = [];

function baseForm(): FormState {
  return buildBaseForm(makeProject(), undefined, undefined, EMPTY_CHAIN);
}

describe('buildSavePatch', () => {
  it('form = base -> {}', () => {
    const base = baseForm();
    expect(buildSavePatch(base, { ...base }, { canEditFinance: false })).toEqual({});
  });

  it('doi dung ten -> { projectName }', () => {
    const base = baseForm();
    const form = { ...base, projectName: 'Ten moi' };
    expect(buildSavePatch(base, form, { canEditFinance: false })).toEqual({ projectName: 'Ten moi' });
  });

  it('doi 1 giai doan -> co chain du 7 phan tu', () => {
    const base = baseForm();
    const form: FormState = { ...base, stagePct: { ...base.stagePct, design: '50' } };
    const patch = buildSavePatch(base, form, { canEditFinance: false });
    expect(patch.chain).toHaveLength(7);
  });

  it('khong doi giai doan -> khong co chain', () => {
    const base = baseForm();
    const patch = buildSavePatch(base, { ...base }, { canEditFinance: false });
    expect(patch.chain).toBeUndefined();
  });

  it('doi doanh thu voi canEditFinance:false -> khong co key tai chinh', () => {
    const base = baseForm();
    const form = { ...base, revenueCumulative: '999' };
    const patch = buildSavePatch(base, form, { canEditFinance: false });
    expect(patch.revenueCumulative).toBeUndefined();
  });

  it('doi doanh thu voi canEditFinance:true -> co key tai chinh', () => {
    const base = baseForm();
    const form = { ...base, revenueCumulative: '999' };
    const patch = buildSavePatch(base, form, { canEditFinance: true });
    expect(patch.revenueCumulative).toBe(999);
  });

  it('xoa penaltyValue -> null', () => {
    const base = { ...baseForm(), penaltyValue: '15' };
    const form = { ...base, penaltyValue: '' };
    const patch = buildSavePatch(base, form, { canEditFinance: false });
    expect(patch.penaltyValue).toBeNull();
  });

  it('xoa contractValue -> khong co key', () => {
    const base = baseForm();
    const form = { ...base, contractValue: '' };
    const patch = buildSavePatch(base, form, { canEditFinance: false });
    expect(patch.contractValue).toBeUndefined();
  });

  it('xoa 1 ngay -> null', () => {
    const base = { ...baseForm(), contractDate: '2026-01-01' };
    const form = { ...base, contractDate: '' };
    const patch = buildSavePatch(base, form, { canEditFinance: false });
    expect(patch.contractDate).toBeNull();
  });

  it("doi khu vuc ve '' -> factoryId: null", () => {
    const base = { ...baseForm(), factoryId: '2' };
    const form = { ...base, factoryId: '' };
    const patch = buildSavePatch(base, form, { canEditFinance: false });
    expect(patch.factoryId).toBeNull();
  });

  it('xoa san luong -> khong co key', () => {
    const base = { ...baseForm(), volumeTonnage: '100' };
    const form = { ...base, volumeTonnage: '' };
    const patch = buildSavePatch(base, form, { canEditFinance: false });
    expect(patch.volumeTonnage).toBeUndefined();
  });

  it('doi san luong -> co key so', () => {
    const base = baseForm();
    const form = { ...base, volumeTonnage: '150' };
    const patch = buildSavePatch(base, form, { canEditFinance: false });
    expect(patch.volumeTonnage).toBe(150);
  });
});

describe('checkDraft', () => {
  const current: DraftStamp = {
    projectCreatedAt: '2026-01-01T00:00:00.000Z',
    projectUpdatedAt: '2026-01-01T00:00:00.000Z',
    factVersion: 1,
    financialVersion: 1,
  };
  const draftOf = (stamp: DraftStamp): StoredDraft => ({
    v: DRAFT_VERSION,
    savedAt: '2026-01-02T00:00:00.000Z',
    stamp,
    form: baseForm(),
  });

  it('raw null -> none', () => expect(checkDraft(null, current)).toEqual({ kind: 'none' }));
  it('JSON hong -> none', () => expect(checkDraft('{invalid', current)).toEqual({ kind: 'none' }));
  it('v=1 (cu) -> none', () => {
    const raw = JSON.stringify({ ...draftOf(current), v: 1 });
    expect(checkDraft(raw, current)).toEqual({ kind: 'none' });
  });
  it('v=2 (F6, truoc khi gan theo email) -> none', () => {
    const raw = JSON.stringify({ ...draftOf(current), v: 2 });
    expect(checkDraft(raw, current)).toEqual({ kind: 'none' });
  });
  it('du an khac trung id (projectCreatedAt khac) -> foreign', () => {
    const raw = JSON.stringify(draftOf({ ...current, projectCreatedAt: '2020-01-01T00:00:00.000Z' }));
    expect(checkDraft(raw, current).kind).toBe('foreign');
  });
  it('4 truong stamp bang nhau -> fresh', () => {
    const raw = JSON.stringify(draftOf(current));
    expect(checkDraft(raw, current).kind).toBe('fresh');
  });
  it('khac projectUpdatedAt -> stale', () => {
    const raw = JSON.stringify(draftOf({ ...current, projectUpdatedAt: '2026-02-01T00:00:00.000Z' }));
    expect(checkDraft(raw, current).kind).toBe('stale');
  });
  it('khac factVersion -> stale', () => {
    const raw = JSON.stringify(draftOf({ ...current, factVersion: 2 }));
    expect(checkDraft(raw, current).kind).toBe('stale');
  });
});

describe('restoreDraft', () => {
  it('draft thieu field moi (khong co stageApplicable) van tra du field tu base', () => {
    const base = baseForm();
    const { stageApplicable: _omit, ...rest } = base;
    const partialForm = rest as FormState;
    const draft: StoredDraft = {
      v: DRAFT_VERSION,
      savedAt: '2026-01-02T00:00:00.000Z',
      stamp: { projectCreatedAt: '', projectUpdatedAt: '', factVersion: null, financialVersion: null },
      form: partialForm as FormState,
    };
    const restored = restoreDraft(base, draft);
    expect(restored.stageApplicable).toEqual(base.stageApplicable);
    for (const s of STAGE_ORDER) expect(restored.stageApplicable[s]).toBeDefined();
  });

  it('JSON bi chen truong tai chinh/ho so (revenueCumulative, projectName) -> giu nguyen gia tri base', () => {
    const base = baseForm();
    const tampered = {
      ...base,
      revenueCumulative: '999999',
      projectName: 'TEN BI CHEN TU NHAP LAI',
      pctPlan: '55',
    } as unknown as FormState;
    const draft: StoredDraft = {
      v: DRAFT_VERSION,
      savedAt: '2026-01-02T00:00:00.000Z',
      stamp: { projectCreatedAt: '', projectUpdatedAt: '', factVersion: null, financialVersion: null },
      form: tampered,
    };
    const restored = restoreDraft(base, draft);
    expect(restored.revenueCumulative).toBe(base.revenueCumulative);
    expect(restored.projectName).toBe(base.projectName);
    expect(restored.pctPlan).toBe('55');
  });
});

describe('toDraftForm', () => {
  it('khong co key tai chinh hay ho so', () => {
    const form = toDraftForm(baseForm());
    expect(form).not.toHaveProperty('revenueCumulative');
    expect(form).not.toHaveProperty('costActualCumulative');
    expect(form).not.toHaveProperty('projectName');
    expect(form).toHaveProperty('pctPlan');
    expect(form).toHaveProperty('stagePct');
  });
});

describe('draftFieldsEqual', () => {
  it('giong nhau -> true', () => {
    const base = baseForm();
    expect(draftFieldsEqual(base, { ...base })).toBe(true);
  });

  it('khac field ho so (projectName) khong tinh -> van true', () => {
    const base = baseForm();
    expect(draftFieldsEqual(base, { ...base, projectName: 'TEN KHAC' })).toBe(true);
  });

  it('khac pctPlan -> false', () => {
    const base = baseForm();
    expect(draftFieldsEqual(base, { ...base, pctPlan: '77' })).toBe(false);
  });
});

describe('saveErrorKind', () => {
  it.each([
    ['Forbidden', 'forbidden'],
    ['locked', 'locked'],
    ['Not found', 'notFound'],
    ['Bat ky loi nao khac', 'generic'],
  ] as const)('%s -> %s', (error, kind) => {
    expect(saveErrorKind(error)).toBe(kind);
  });
});

describe('formsEqual', () => {
  it('giong nhau -> true', () => {
    const base = baseForm();
    expect(formsEqual(base, { ...base })).toBe(true);
  });
  it('khac 1 giai doan -> false', () => {
    const base = baseForm();
    const other: FormState = { ...base, stagePct: { ...base.stagePct, design: '99' } };
    expect(formsEqual(base, other)).toBe(false);
  });
});

