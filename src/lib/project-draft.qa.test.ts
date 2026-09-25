import { describe, expect, it } from 'vitest';
import { checkProjectDraft, restoreProjectDraft, type ProjectDraft } from './project-draft';
import { emptyProjectForm, type ProjectFormState } from '@/lib/project-form';

/**
 * Kiem thu doc lap F6/ProjectForm (Task 10) - bo sung cac nhanh loi du lieu ma
 * `project-draft.test.ts` cua coder chua cham: JSON hong, thieu `form`, sai version so, va
 * restoreProjectDraft VAN chi ap field dung KIEU (bo qua field so/boolean lech kieu).
 */
const FORM: ProjectFormState = { ...emptyProjectForm(), projectName: 'DU AN QA NHAP' };

function draft(over: Partial<ProjectDraft> = {}): ProjectDraft {
  return {
    v: 1, savedAt: '2026-09-16T00:00:00.000Z', projectCreatedAt: null, projectUpdatedAt: null,
    form: FORM, keyMilestones: [], stageWeights: [],
    ...over,
  };
}

describe('checkProjectDraft - du lieu hong/thieu', () => {
  it('JSON khong hop le -> none (khong crash)', () => {
    expect(checkProjectDraft('{khong phai json', null)).toEqual({ kind: 'none' });
  });

  it('thieu truong form -> none', () => {
    const raw = JSON.stringify({ v: 1, savedAt: '', projectCreatedAt: null, projectUpdatedAt: null });
    expect(checkProjectDraft(raw, null)).toEqual({ kind: 'none' });
  });

  it('version khac 1 (vi du v=2 tuong lai) -> none', () => {
    const raw = JSON.stringify({ ...draft(), v: 2 });
    expect(checkProjectDraft(raw, null)).toEqual({ kind: 'none' });
  });

  it('chuoi rong -> none', () => {
    expect(checkProjectDraft('', null)).toEqual({ kind: 'none' });
  });
});

describe('restoreProjectDraft - bo qua field sai kieu (chong JSON bi chinh tay)', () => {
  it('projectName la so (khong phai string) trong JSON -> giu nguyen base, khong crash', () => {
    const base = emptyProjectForm();
    const tampered = { ...draft(), form: { ...FORM, projectName: 12345 } } as unknown as ProjectDraft;
    const result = restoreProjectDraft(base, tampered);
    expect(result.projectName).toBe(base.projectName);
  });

  it('penalized la chuoi "true" (khong phai boolean that) -> giu nguyen gia tri base', () => {
    const base = { ...emptyProjectForm(), penalized: false };
    const tampered = { ...draft(), form: { ...FORM, penalized: 'true' } } as unknown as ProjectDraft;
    const result = restoreProjectDraft(base, tampered);
    expect(result.penalized).toBe(false);
  });

  it('penalized dung kieu boolean -> duoc ap dung', () => {
    const base = { ...emptyProjectForm(), penalized: false };
    const tampered = draft({ form: { ...FORM, penalized: true } });
    const result = restoreProjectDraft(base, tampered);
    expect(result.penalized).toBe(true);
  });
});
