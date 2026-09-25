import { describe, expect, it } from 'vitest';
import { checkProfileRules, type ProfileFields } from './project-profile-rules';
import type { ExchangeRate } from '@/server/repo/types';

/**
 * Kiem thu doc lap G-11/G-12/G-7/G-8 - bo sung 3 luat chuoi ngay MA project-profile-rules.test.ts
 * cua coder CHUA cham toi (handover_before_finish, contract_after_start, actual_order), cong voi
 * EUR, bien 160 ky tu dung het, tonnage rat nho > 0, va gia tri contractValue KHONG bi tinh lai
 * khi ty gia doi sau khi da luu (chot cung, mock-up dong 950-951).
 */
const RATES: ExchangeRate[] = [
  { currencyCode: 'VND', yearMonth: '2026-09', rateToVnd: 1, source: 'manual', updatedBy: 'system', updatedAt: null },
  { currencyCode: 'USD', yearMonth: '2026-09', rateToVnd: 25400, source: 'manual', updatedBy: 'system', updatedAt: null },
  { currencyCode: 'EUR', yearMonth: '2026-09', rateToVnd: 27500, source: 'manual', updatedBy: 'system', updatedAt: null },
];

const BASE: ProfileFields = {
  projectName: 'DU AN MAU QA',
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

describe('checkProfileRules - 3 luat chuoi ngay con lai (tao moi)', () => {
  it('Ban giao cam ket SOM HON Ngay HT ke hoach -> handover_before_finish', () => {
    const r = checkProfileRules(null, { ...BASE, committedHandoverDate: '2027-01-01' }, RATES);
    expect(r).toMatchObject({ ok: false, error: 'date_handover_before_finish' });
  });

  it('Ngay ky HD SAU Ngay BD ke hoach -> contract_after_start', () => {
    const r = checkProfileRules(null, { ...BASE, contractDate: '2026-10-01' }, RATES);
    expect(r).toMatchObject({ ok: false, error: 'date_contract_after_start' });
  });

  it('Ngay HT thuc te TRUOC Ngay BD thuc te -> actual_order', () => {
    const r = checkProfileRules(
      null,
      { ...BASE, actualStartDate: '2026-09-05', actualFinishDate: '2026-09-01' },
      RATES,
    );
    expect(r).toMatchObject({ ok: false, error: 'date_actual_order' });
  });

  it('Ban giao = Ngay HT ke hoach (bang nhau) -> KHONG loi (chi chan khi < )', () => {
    const r = checkProfileRules(null, { ...BASE, committedHandoverDate: BASE.plannedFinishDate }, RATES);
    expect(r.ok).toBe(true);
  });
});

describe('checkProfileRules - sua: luat chi xet khi patch dung toi 1 trong 2 ngay', () => {
  it('du an co san actualStart/actualFinish LECH, patch chi doi projectName -> khong bi chan', () => {
    const skewedActual: ProfileFields = { ...BASE, actualStartDate: '2026-10-01', actualFinishDate: '2026-09-01' };
    const r = checkProfileRules(skewedActual, { projectName: 'TEN MOI QA' }, RATES);
    expect(r.ok).toBe(true);
  });

  it('cung du an loi actual_order, nhung patch DUNG toi actualFinishDate -> bi chan lai', () => {
    const skewedActual: ProfileFields = { ...BASE, actualStartDate: '2026-10-01', actualFinishDate: '2026-09-01' };
    const r = checkProfileRules(skewedActual, { actualFinishDate: '2026-09-02' }, RATES);
    expect(r).toMatchObject({ ok: false, error: 'date_actual_order' });
  });
});

describe('checkProfileRules - G-7 EUR + tonnage rat nho + ten dung het 160', () => {
  it('EUR + nguyen te + co ty gia thang ky -> quy doi dung theo rate EUR (khac USD)', () => {
    const r = checkProfileRules(
      null,
      { ...BASE, currencyCode: 'EUR', contractValueOriginal: 1_000, contractDate: '2026-09-01' },
      RATES,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.patch.contractValue).toBe(0.0275); // 1000 * 27500 / 1e9
  });

  it('tonnage rat nho nhung > 0 -> khong bi tonnage_required', () => {
    const r = checkProfileRules(null, { ...BASE, tonnage: 0.001 }, RATES);
    expect(r.ok).toBe(true);
  });

  it('ten dung DUNG 160 ky tu -> hop le (chi qua 160 moi loi)', () => {
    const r = checkProfileRules(null, { ...BASE, projectName: 'A'.repeat(160) }, RATES);
    expect(r.ok).toBe(true);
  });

  it('sua: doi ty gia SAU khi da luu KHONG lam contractValue cu bi tinh lai (chot cung)', () => {
    // Du an da luu contractValue = 25.4 (USD 1_000_000 x 25400) tu truoc, gio ty gia thang do da doi
    // (vi du sua lai 30000) nhung patch KHONG dung toi contractValueOriginal/currencyCode/contractDate.
    const already: ProfileFields = { ...BASE, currencyCode: 'USD', contractValueOriginal: 1_000_000, contractValue: 25.4, contractDate: '2026-09-01' };
    const newRates: ExchangeRate[] = [{ currencyCode: 'USD', yearMonth: '2026-09', rateToVnd: 30_000, source: 'manual', updatedBy: 'system', updatedAt: null }];
    const r = checkProfileRules(already, { tonnage: 600 }, newRates);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.patch as Partial<ProfileFields>).contractValue).toBeUndefined(); // khong dong cham lai
  });
});
