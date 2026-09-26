import { describe, expect, it } from 'vitest';
import type { Project, ValueChainProgress } from '@/server/repo/types';
import { buildBaseForm, DRAFT_FIELDS, toDraftForm } from './dataEntryState';

/**
 * Kiem thu doc lap F6 (Task 10) - mo phong dung DevTools: chuoi JSON se thuc su ghi vao
 * localStorage (`JSON.stringify(toDraftForm(...))`) KHONG duoc chua bat ky con so/ten nao thuoc
 * ho so tai chinh, du gia tri do CO trong form goc. Day la kiem tra "nhin bang mat" ma
 * `dataEntryState.test.ts` cua coder chua lam truc tiep (coder chi kiem `not.toHaveProperty`).
 */
function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1, masterCode: 'M-00099', currentAliasCode: 'CT-QA-99', projectName: 'TEN DU AN RAT NHAY CAM QA',
    customerId: 1, teamKdId: 1, marketCode: 'TN', projectType: 'EPC', priority: 'P1',
    contractValue: 1234.5678, tonnage: 500, currencyCode: 'USD', contractDate: null,
    plannedStartDate: null, plannedFinishDate: null, committedHandoverDate: null,
    actualStartDate: null, actualFinishDate: null, penaltyValue: 9999, penalized: true,
    isActive: true, factoryId: null, contractValueOriginal: 888888,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system', updatedBy: 'system',
    ...overrides,
  };
}

const EMPTY_CHAIN: ValueChainProgress[] = [];

describe('F6 - chuoi JSON ghi vao localStorage khong lo so tien/ten du an', () => {
  it('JSON.stringify(toDraftForm(...)) khong chua ten du an nhay cam, khong chua cac con so tai chinh dac trung', () => {
    const base = buildBaseForm(makeProject(), undefined, undefined, EMPTY_CHAIN, null, ['design']);
    const draftForm = toDraftForm(base);
    const json = JSON.stringify(draftForm);

    expect(json).not.toContain('RAT NHAY CAM'); // ten du an
    expect(json).not.toContain('1234.5678'); // contractValue
    expect(json).not.toContain('888888'); // contractValueOriginal
    expect(json).not.toContain('9999'); // penaltyValue
    expect(json).not.toContain('M-00099'); // masterCode
    expect(json).not.toContain('CT-QA-99'); // currentAliasCode
  });

  it('DRAFT_FIELDS dung CHINH XAC 6 field da chot - khong bi them field ho so nao khac vao sau nay', () => {
    expect([...DRAFT_FIELDS].sort()).toEqual(
      ['ac', 'equipmentActual', 'pctPlan', 'stageApplicable', 'stagePct', 'volumeTonnage'].sort(),
    );
  });

  it('moi key cua toDraftForm(...) deu nam trong DRAFT_FIELDS (khong lot field la)', () => {
    const base = buildBaseForm(makeProject(), undefined, undefined, EMPTY_CHAIN, null, ['design']);
    const draftForm = toDraftForm(base);
    for (const k of Object.keys(draftForm)) {
      expect((DRAFT_FIELDS as readonly string[]).includes(k)).toBe(true);
    }
  });
});
