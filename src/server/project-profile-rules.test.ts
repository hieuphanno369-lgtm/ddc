import { describe, expect, it } from 'vitest';
import { checkProfileRules, type ProfileFields } from './project-profile-rules';
import type { ExchangeRate } from '@/server/repo/types';

const RATES: ExchangeRate[] = [
  { currencyCode: 'VND', yearMonth: '2026-09', rateToVnd: 1, source: 'manual', updatedBy: 'system', updatedAt: null },
  { currencyCode: 'USD', yearMonth: '2026-09', rateToVnd: 25400, source: 'manual', updatedBy: 'system', updatedAt: null },
];

const BASE: ProfileFields = {
  projectName: 'DU AN MAU',
  tonnage: 500,
  currencyCode: 'VND',
  contractValue: 100,
  contractValueOriginal: null,
  contractDate: '2026-08-01',
  plannedStartDate: '2026-09-01',
  plannedFinishDate: '2027-03-01',
  committedHandoverDate: '2027-03-15',
  actualStartDate: null,
  actualFinishDate: null,
};

describe('checkProfileRules - tao moi', () => {
  it('du du lieu -> ok', () => {
    const r = checkProfileRules(null, BASE, RATES);
    expect(r.ok).toBe(true);
  });

  it('thieu tonnage -> tonnage_required', () => {
    const r = checkProfileRules(null, { ...BASE, tonnage: 0 }, RATES);
    expect(r).toMatchObject({ ok: false, error: 'tonnage_required' });
  });

  it('thieu 1 trong 3 ngay bat buoc -> date_required', () => {
    const r = checkProfileRules(null, { ...BASE, plannedStartDate: null }, RATES);
    expect(r).toMatchObject({ ok: false, error: 'date_required' });
  });

  it('ten qua 160 ky tu -> name_too_long', () => {
    const r = checkProfileRules(null, { ...BASE, projectName: 'A'.repeat(161) }, RATES);
    expect(r).toMatchObject({ ok: false, error: 'name_too_long' });
  });

  it('ngay lech (BD >= HT ke hoach) -> date_plan_order', () => {
    const r = checkProfileRules(null, { ...BASE, plannedStartDate: '2027-06-01', plannedFinishDate: '2027-03-01' }, RATES);
    expect(r).toMatchObject({ ok: false, error: 'date_plan_order' });
  });

  it('USD + nguyen te + co ty gia thang ky -> quy doi va ghi de contractValue', () => {
    const r = checkProfileRules(null, { ...BASE, currencyCode: 'USD', contractValueOriginal: 1_000, contractDate: '2026-09-01' }, RATES);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.patch.contractValue).toBe(0.0254);
  });

  it('USD + nguyen te nhung khong co ty gia thang ky -> fx_rate_missing', () => {
    const r = checkProfileRules(null, { ...BASE, currencyCode: 'USD', contractValueOriginal: 1_000, contractDate: '2025-01-15' }, RATES);
    expect(r).toMatchObject({ ok: false, error: 'fx_rate_missing' });
  });

  it('USD + nguyen te nhung chua co ngay ky -> fx_contract_date_required', () => {
    const r = checkProfileRules(null, { ...BASE, currencyCode: 'USD', contractValueOriginal: 1_000, contractDate: null }, RATES);
    expect(r).toMatchObject({ ok: false, error: 'fx_contract_date_required' });
  });
});

describe('checkProfileRules - sua', () => {
  it('du an cu ngay lech san co, patch chi co projectName -> van luu duoc', () => {
    const skewed: ProfileFields = { ...BASE, plannedStartDate: '2027-06-01', plannedFinishDate: '2027-03-01' };
    const r = checkProfileRules(skewed, { projectName: 'TEN MOI' }, RATES);
    expect(r.ok).toBe(true);
  });

  it('xoa 1 trong 3 ngay bat buoc (dat null) -> date_required', () => {
    const r = checkProfileRules(BASE, { plannedStartDate: null }, RATES);
    expect(r).toMatchObject({ ok: false, error: 'date_required' });
  });

  it('sua tonnage ve 0 -> tonnage_required', () => {
    const r = checkProfileRules(BASE, { tonnage: 0 }, RATES);
    expect(r).toMatchObject({ ok: false, error: 'tonnage_required' });
  });

  it('doi sang VND -> contractValueOriginal ve null', () => {
    const usdBase: ProfileFields = { ...BASE, currencyCode: 'USD', contractValueOriginal: 1_000, contractValue: 25.4 };
    const r = checkProfileRules(usdBase, { currencyCode: 'VND' }, RATES);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.patch as Partial<ProfileFields>).contractValueOriginal).toBeNull();
  });

  it('patch khong dung tay vao ngay lech thi khong bi chan boi luat chuoi ngay cu', () => {
    const skewed: ProfileFields = { ...BASE, plannedStartDate: '2027-06-01', plannedFinishDate: '2027-03-01' };
    const r = checkProfileRules(skewed, { tonnage: 600 }, RATES);
    expect(r.ok).toBe(true);
  });
});
