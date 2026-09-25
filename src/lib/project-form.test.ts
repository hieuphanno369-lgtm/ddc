import { describe, expect, it } from 'vitest';
import { checkDateChain, dateInput, type DateChainInput } from './project-form';

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
