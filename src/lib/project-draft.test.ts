import { describe, expect, it } from 'vitest';
import { checkProjectDraft, projectDraftKey, restoreProjectDraft, toProjectDraftForm, type ProjectDraft } from './project-draft';
import { emptyProjectForm, type ProjectFormState } from '@/lib/project-form';

const FORM: ProjectFormState = { ...emptyProjectForm(), projectName: 'DU AN NHAP' };

function draft(over: Partial<ProjectDraft> = {}): ProjectDraft {
  return {
    v: 1,
    savedAt: '2026-09-16T00:00:00.000Z',
    projectCreatedAt: null,
    projectUpdatedAt: null,
    form: FORM,
    keyMilestones: [],
    stageWeights: [],
    ...over,
  };
}

describe('projectDraftKey', () => {
  it('du an moi -> hau to "new"', () => {
    expect(projectDraftKey('abc123', null)).toBe('ddc_pform_v1_abc123_new');
  });
  it('du an co id -> hau to id', () => {
    expect(projectDraftKey('abc123', 7)).toBe('ddc_pform_v1_abc123_7');
  });
});

describe('checkProjectDraft', () => {
  it('khong co raw -> none', () => {
    expect(checkProjectDraft(null, null)).toEqual({ kind: 'none' });
  });

  it('che do TAO, draft cung la cua che do tao -> fresh', () => {
    const d = draft({ projectCreatedAt: null });
    expect(checkProjectDraft(JSON.stringify(d), null)).toEqual({ kind: 'fresh', draft: d });
  });

  it('che do TAO nhung draft thuoc 1 du an cu the -> foreign', () => {
    const d = draft({ projectCreatedAt: '2026-01-01T00:00:00.000Z' });
    expect(checkProjectDraft(JSON.stringify(d), null)).toEqual({ kind: 'foreign' });
  });

  it('che do SUA, projectCreatedAt khac -> foreign', () => {
    const d = draft({ projectCreatedAt: '2025-01-01T00:00:00.000Z', projectUpdatedAt: '2025-01-01T00:00:00.000Z' });
    const project = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    expect(checkProjectDraft(JSON.stringify(d), project)).toEqual({ kind: 'foreign' });
  });

  it('che do SUA, projectUpdatedAt khac -> stale', () => {
    const created = '2026-01-01T00:00:00.000Z';
    const d = draft({ projectCreatedAt: created, projectUpdatedAt: '2026-05-01T00:00:00.000Z' });
    const project = { createdAt: created, updatedAt: '2026-09-01T00:00:00.000Z' };
    expect(checkProjectDraft(JSON.stringify(d), project)).toEqual({ kind: 'stale', draft: d });
  });

  it('che do SUA, khop het -> fresh', () => {
    const created = '2026-01-01T00:00:00.000Z';
    const updated = '2026-09-01T00:00:00.000Z';
    const d = draft({ projectCreatedAt: created, projectUpdatedAt: updated });
    const project = { createdAt: created, updatedAt: updated };
    expect(checkProjectDraft(JSON.stringify(d), project)).toEqual({ kind: 'fresh', draft: d });
  });
});

describe('restoreProjectDraft', () => {
  it('chi ap field thuoc ProjectFormState, bo key la', () => {
    const base = emptyProjectForm();
    const tampered = {
      ...draft(),
      form: { ...FORM, projectName: 'TU NHAP LAI', masterCode: 'HACKED' },
    } as unknown as ProjectDraft;
    const result = restoreProjectDraft(base, tampered);
    expect(result.projectName).toBe('TU NHAP LAI');
    expect('masterCode' in result).toBe(false);
  });

  it('(S-3) JSON nhap co chen contractValue/penaltyValue -> van giu gia tri base, khong ap tu nhap', () => {
    const base: ProjectFormState = { ...emptyProjectForm(), contractValue: '100', contractValueOriginal: '5000', penaltyValue: '2' };
    const tampered = {
      ...draft(),
      form: { ...FORM, contractValue: '999', contractValueOriginal: '888', penaltyValue: '777' },
    } as unknown as ProjectDraft;
    const result = restoreProjectDraft(base, tampered);
    expect(result.contractValue).toBe('100');
    expect(result.contractValueOriginal).toBe('5000');
    expect(result.penaltyValue).toBe('2');
  });
});

describe('toProjectDraftForm (S-3)', () => {
  it('JSON.stringify khong chua contractValue/contractValueOriginal/penaltyValue', () => {
    const form: ProjectFormState = {
      ...FORM, contractValue: '123.456', contractValueOriginal: '5000', penaltyValue: '9',
    };
    const json = JSON.stringify(toProjectDraftForm(form));
    expect(json).not.toContain('contractValue');
    expect(json).not.toContain('penaltyValue');
  });

  it('giu nguyen cac field ho so con lai (vd projectName)', () => {
    const form: ProjectFormState = { ...FORM, projectName: 'DU AN GIU LAI' };
    expect(toProjectDraftForm(form).projectName).toBe('DU AN GIU LAI');
  });
});
