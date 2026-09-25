import { describe, expect, it } from 'vitest';
import { evaluateProjectAlerts, type AlertRuleInput } from './alert-rules';

const BASE_PROJECT = {
  id: 1,
  contractValue: 100,
  committedHandoverDate: null as string | null,
  penalized: false,
  actualStartDate: '2026-01-01',
  actualFinishDate: null as string | null,
};

function baseInput(over: Partial<AlertRuleInput> = {}): AlertRuleInput {
  return {
    project: BASE_PROJECT,
    yearMonth: '2026-09',
    today: '2026-09-16',
    fact: null,
    financial: null,
    manpower: null,
    equipment: null,
    ...over,
  };
}

describe('evaluateProjectAlerts', () => {
  it('SPI 0.9 khong ban, 0.89 ban (Amber, chuoi khop van seed)', () => {
    const notFired = evaluateProjectAlerts(baseInput({ fact: { spi: 0.9, cpi: null, pctActual: 0.5 } }));
    expect(notFired.find((a) => a.ruleCode === 'spi_low')).toBeUndefined();

    const fired = evaluateProjectAlerts(baseInput({ fact: { spi: 0.89, cpi: null, pctActual: 0.5 } }));
    const alert = fired.find((a) => a.ruleCode === 'spi_low');
    expect(alert).toMatchObject({
      alertType: 'Amber', ruleTriggered: 'SPI < 0.9', message: 'SPI = 0.89 - trễ tiến độ theo giá trị',
      dedupeKey: 'spi_low:2026-09',
    });
  });

  it('CPI 0.9 khong ban, 0.89 ban', () => {
    const notFired = evaluateProjectAlerts(baseInput({ fact: { spi: null, cpi: 0.9, pctActual: 0.5 } }));
    expect(notFired.find((a) => a.ruleCode === 'cpi_low')).toBeUndefined();

    const fired = evaluateProjectAlerts(baseInput({ fact: { spi: null, cpi: 0.89, pctActual: 0.5 } }));
    expect(fired.find((a) => a.ruleCode === 'cpi_low')).toMatchObject({
      alertType: 'Amber', ruleTriggered: 'CPI < 0.9', message: 'CPI = 0.89 - vượt chi phí', dedupeKey: 'cpi_low:2026-09',
    });
  });

  it('penalty_overdue: da bi phat -> Red, khong phu thuoc ngay', () => {
    const res = evaluateProjectAlerts(baseInput({
      project: { ...BASE_PROJECT, penalized: true, committedHandoverDate: '2026-05-01' },
      fact: { spi: null, cpi: null, pctActual: 0.8 },
    }));
    expect(res.find((a) => a.ruleCode === 'penalty_overdue')).toMatchObject({
      alertType: 'Red', ruleTriggered: 'Đã quá mốc cam kết', dedupeKey: 'penalty_overdue:2026-05-01',
    });
  });

  it('penalty_risk: con <=30 ngay den moc ban giao va chua dat 100%', () => {
    const res = evaluateProjectAlerts(baseInput({
      project: { ...BASE_PROJECT, committedHandoverDate: '2026-10-01' },
      fact: { spi: null, cpi: null, pctActual: 0.8 },
    }));
    expect(res.find((a) => a.ruleCode === 'penalty_risk')).toMatchObject({
      alertType: 'Red', ruleTriggered: 'Nguy cơ phạt HĐ (≤30 ngày)', dedupeKey: 'penalty_risk:2026-10-01',
    });
  });

  it('penalty_risk khong ban khi con > 30 ngay', () => {
    const res = evaluateProjectAlerts(baseInput({
      project: { ...BASE_PROJECT, committedHandoverDate: '2027-01-01' },
      fact: { spi: null, cpi: null, pctActual: 0.8 },
    }));
    expect(res.find((a) => a.ruleCode === 'penalty_risk')).toBeUndefined();
  });

  it('ar_overdue: cong no qua han > 5% HD -> Amber', () => {
    const notFired = evaluateProjectAlerts(baseInput({ financial: { arOverdue: 5 } }));
    expect(notFired.find((a) => a.ruleCode === 'ar_overdue')).toBeUndefined();

    const fired = evaluateProjectAlerts(baseInput({ financial: { arOverdue: 6 } }));
    expect(fired.find((a) => a.ruleCode === 'ar_overdue')).toMatchObject({
      alertType: 'Amber', ruleTriggered: 'Công nợ quá hạn > 5% HĐ', dedupeKey: 'ar_overdue:2026-09',
    });
  });

  it('manpower_low: TT/KH < 85% -> Amber; null -> khong ban', () => {
    expect(evaluateProjectAlerts(baseInput({ manpower: null })).find((a) => a.ruleCode === 'manpower_low')).toBeUndefined();

    const notFired = evaluateProjectAlerts(baseInput({ manpower: { workDate: '2026-09-15', planned: 100, actual: 90 } }));
    expect(notFired.find((a) => a.ruleCode === 'manpower_low')).toBeUndefined();

    const fired = evaluateProjectAlerts(baseInput({ manpower: { workDate: '2026-09-15', planned: 100, actual: 80 } }));
    expect(fired.find((a) => a.ruleCode === 'manpower_low')).toMatchObject({
      alertType: 'Amber', ruleTriggered: 'Huy động nhân lực < 85%',
      message: 'Ngày 15/09: TT 80 / KH 100 (80%)', dedupeKey: 'manpower_low:2026-W38',
    });
  });

  it('equipment_low: TT/KH < 80% -> Amber', () => {
    const notFired = evaluateProjectAlerts(baseInput({ equipment: { workDate: '2026-09-15', planned: 100, actual: 85 } }));
    expect(notFired.find((a) => a.ruleCode === 'equipment_low')).toBeUndefined();

    const fired = evaluateProjectAlerts(baseInput({ equipment: { workDate: '2026-09-15', planned: 100, actual: 70 } }));
    expect(fired.find((a) => a.ruleCode === 'equipment_low')).toMatchObject({
      alertType: 'Amber', ruleTriggered: 'Huy động thiết bị < 80%', dedupeKey: 'equipment_low:2026-W38',
    });
  });

  it("du an 'Hoan_thanh' -> khong ban luat nao", () => {
    const res = evaluateProjectAlerts(baseInput({
      project: { ...BASE_PROJECT, actualFinishDate: '2026-09-10' },
      fact: { spi: 0.5, cpi: 0.5, pctActual: 1 },
      financial: { arOverdue: 999 },
      manpower: { workDate: '2026-09-15', planned: 100, actual: 10 },
      equipment: { workDate: '2026-09-15', planned: 100, actual: 10 },
    }));
    expect(res).toEqual([]);
  });
});
