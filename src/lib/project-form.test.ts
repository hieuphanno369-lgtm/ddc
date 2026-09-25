import { describe, expect, it } from 'vitest';
import {
  buildUpdatePatch, checkDateChain, countFilled, dateInput, emptyProjectForm, fxPreview, validateProjectForm,
  type DateChainInput, type ProjectFormState,
} from './project-form';
import type { ExchangeRate } from '@/server/repo/types';

const BASE: DateChainInput = {
  contractDate: '',
  plannedStartDate: '',
  plannedFinishDate: '',
  committedHandoverDate: '',
  actualStartDate: '',
  actualFinishDate: '',
};

describe('checkDateChain', () => {
  it('day du, dung thu tu -> khong loi, tinh duoc totalPlanDays', () => {
    const r = checkDateChain({
      ...BASE,
      contractDate: '2026-01-01',
      plannedStartDate: '2026-02-01',
      plannedFinishDate: '2026-08-01',
      committedHandoverDate: '2026-08-15',
    });
    expect(r.hard).toEqual([]);
    expect(r.totalPlanDays).toBe(181);
    expect(r.startDelayDays).toBeNull();
  });

  it('nhan ISO day du (co gio) - lay 10 ky tu dau', () => {
    const r = checkDateChain({
      ...BASE,
      plannedStartDate: '2026-01-01T00:00:00.000Z',
      plannedFinishDate: '2026-06-01T00:00:00.000Z',
    });
    expect(r.hard).toEqual([]);
    expect(r.totalPlanDays).toBe(151);
  });

  it('plan_order: BD >= HT ke hoach', () => {
    const r = checkDateChain({ ...BASE, plannedStartDate: '2026-08-01', plannedFinishDate: '2026-02-01' });
    expect(r.hard).toContain('plan_order');
  });

  it('handover_before_finish: Ban giao < HT ke hoach', () => {
    const r = checkDateChain({ ...BASE, plannedFinishDate: '2026-08-01', committedHandoverDate: '2026-07-01' });
    expect(r.hard).toContain('handover_before_finish');
  });

  it('contract_after_start: Ky HD sau BD ke hoach', () => {
    const r = checkDateChain({ ...BASE, contractDate: '2026-03-01', plannedStartDate: '2026-02-01' });
    expect(r.hard).toContain('contract_after_start');
  });

  it('actual_order: HT TT truoc BD TT', () => {
    const r = checkDateChain({ ...BASE, actualStartDate: '2026-05-01', actualFinishDate: '2026-04-01' });
    expect(r.hard).toContain('actual_order');
  });

  it('startDelayDays am khi khoi cong som', () => {
    const r = checkDateChain({ ...BASE, plannedStartDate: '2026-02-10', actualStartDate: '2026-02-01' });
    expect(r.startDelayDays).toBe(-9);
  });

  it('ngay khong hop le coi nhu trong, khong tinh loi', () => {
    const r = checkDateChain({ ...BASE, plannedStartDate: '2026-99-99', plannedFinishDate: '2026-02-01' });
    expect(r.hard).toEqual([]);
    expect(r.totalPlanDays).toBeNull();
  });
});

describe('dateInput', () => {
  it('null/undefined -> chuoi rong', () => {
    expect(dateInput(null)).toBe('');
    expect(dateInput(undefined)).toBe('');
  });

  it('ISO day du -> lay 10 ky tu', () => {
    expect(dateInput('2026-09-16T00:00:00.000Z')).toBe('2026-09-16');
  });
});

const RATES: ExchangeRate[] = [
  { currencyCode: 'USD', yearMonth: '2026-09', rateToVnd: 25400, source: 'manual', updatedBy: 'system', updatedAt: null },
];

const FULL_FORM: ProjectFormState = {
  currentAliasCode: 'CT-1',
  projectName: 'DU AN MAU',
  customerId: '1',
  teamKdId: '1',
  marketCode: 'TN',
  projectType: 'EPC',
  contractValue: '100',
  currencyCode: 'VND',
  contractValueOriginal: '',
  tonnage: '500',
  priority: 'P1',
  factoryId: '',
  contractDate: '2026-08-01',
  plannedStartDate: '2026-09-01',
  plannedFinishDate: '2027-03-01',
  committedHandoverDate: '2027-03-15',
  actualStartDate: '',
  actualFinishDate: '',
  penaltyValue: '',
  penalized: false,
};

describe('countFilled', () => {
  it('form rong chi co currencyCode -> 1', () => {
    expect(countFilled(emptyProjectForm())).toBe(1);
  });
});

describe('validateProjectForm - tao moi', () => {
  it('thieu tonnage -> loi positive', () => {
    const r = validateProjectForm({ ...FULL_FORM, tonnage: '0' }, 'new', null, RATES);
    expect(r.errors.tonnage).toBe('positive');
    expect(r.ok).toBe(false);
  });

  it('du du lieu -> ok', () => {
    const r = validateProjectForm(FULL_FORM, 'new', null, RATES);
    expect(r.ok).toBe(true);
  });
});

describe('validateProjectForm - sua', () => {
  it('base co ngay ma form xoa -> required', () => {
    const r = validateProjectForm({ ...FULL_FORM, plannedStartDate: '' }, 'edit', FULL_FORM, RATES);
    expect(r.errors.plannedStartDate).toBe('required');
  });

  it('base dang trong ngay thi khong bi chan', () => {
    const emptyBase: ProjectFormState = { ...FULL_FORM, plannedStartDate: '' };
    const r = validateProjectForm(emptyBase, 'edit', emptyBase, RATES);
    expect(r.errors.plannedStartDate).toBeUndefined();
  });
});

describe('fxPreview', () => {
  it('VND -> vnd', () => {
    expect(fxPreview(FULL_FORM, RATES)).toEqual({ kind: 'vnd' });
  });

  it('ngoai te nhung khong nhap nguyen te -> manual', () => {
    expect(fxPreview({ ...FULL_FORM, currencyCode: 'USD' }, RATES)).toEqual({ kind: 'manual' });
  });

  it('co nguyen te nhung chua co ngay ky -> no_date', () => {
    expect(fxPreview({ ...FULL_FORM, currencyCode: 'USD', contractValueOriginal: '1000', contractDate: '' }, RATES)).toEqual({ kind: 'no_date' });
  });

  it('co nguyen te + ngay ky nhung khong co ty gia -> no_rate', () => {
    const r = fxPreview({ ...FULL_FORM, currencyCode: 'USD', contractValueOriginal: '1000', contractDate: '2025-01-15' }, RATES);
    expect(r).toEqual({ kind: 'no_rate', ym: '2025-01' });
  });

  it('du dieu kien -> converted', () => {
    const r = fxPreview({ ...FULL_FORM, currencyCode: 'USD', contractValueOriginal: '1000', contractDate: '2026-09-01' }, RATES);
    expect(r).toEqual({ kind: 'converted', rate: 25400, ym: '2026-09', value: 0.0254 });
  });
});

describe('buildUpdatePatch', () => {
  it('chi chua field doi, khong bao gio co currentAliasCode', () => {
    const next: ProjectFormState = { ...FULL_FORM, tonnage: '600' };
    const patch = buildUpdatePatch(FULL_FORM, next, fxPreview(next, RATES));
    expect(patch).toEqual({ tonnage: 600 });
    expect('currentAliasCode' in patch).toBe(false);
  });

  it('khong doi gi -> patch rong', () => {
    const patch = buildUpdatePatch(FULL_FORM, FULL_FORM, fxPreview(FULL_FORM, RATES));
    expect(patch).toEqual({});
  });
});
