import { describe, expect, it } from 'vitest';
import {
  isMoneyAlert,
  maskAlertMessage,
  maskGroupRows,
  maskProjectSummaries,
  maskProjectSummary,
  safeListSort,
} from './finance-gate';
import type { ProjectSummary } from '@/server/queries';

const SUMMARY: ProjectSummary = {
  id: 1,
  masterCode: 'M001',
  currentAliasCode: 'A001',
  projectName: 'Du an X',
  customerId: 1,
  customerName: 'KH X',
  teamName: 'KD1',
  teamKdId: 1,
  projectType: 'EPC',
  marketCode: 'TN',
  priority: 'P0',
  status: 'Dang_trien_khai',
  onTrack: true,
  penalty: 'none',
  contractValue: 123.4,
  tonnage: 900,
  pctPlan: 50,
  pctActual: 48,
  spi: 0.96,
  cpi: 0.94,
  eac: 150,
  vac: -26.6,
  bottleneckStage: null,
  dataState: { kind: 'current', month: '2026-09' },
};

describe('maskProjectSummary', () => {
  it('canViewFinance=false -> 3 truong tien thanh null, cac truong khac giu nguyen', () => {
    const masked = maskProjectSummary(SUMMARY, false);
    expect(masked.contractValue).toBeNull();
    expect(masked.eac).toBeNull();
    expect(masked.vac).toBeNull();
    expect(masked.spi).toBe(0.96);
    expect(masked.cpi).toBe(0.94);
    expect(masked.pctActual).toBe(48);
    expect(masked.tonnage).toBe(900);
  });

  it('P4 D-12: dataState (khong phai tien) duoc giu nguyen khi che', () => {
    expect(maskProjectSummary(SUMMARY, false).dataState).toEqual({ kind: 'current', month: '2026-09' });
  });

  it('khong sua object goc', () => {
    maskProjectSummary(SUMMARY, false);
    expect(SUMMARY.contractValue).toBe(123.4);
  });

  it('canViewFinance=true -> bang gia tri goc', () => {
    expect(maskProjectSummary(SUMMARY, true)).toEqual(SUMMARY);
  });

  it('maskProjectSummaries anh xa ca danh sach', () => {
    const list = maskProjectSummaries([SUMMARY], false);
    expect(list).toHaveLength(1);
    expect(list[0].contractValue).toBeNull();
  });
});

describe('maskGroupRows', () => {
  const rows = [{ key: 'KD1', tonnage: 900, value: 55.5 }];

  it('canViewFinance=false -> value null, tonnage giu nguyen', () => {
    const masked = maskGroupRows(rows, false);
    expect(masked.every((r) => r.value === null)).toBe(true);
    expect(masked[0].tonnage).toBe(900);
  });

  it('canViewFinance=true -> value giu nguyen', () => {
    expect(maskGroupRows(rows, true)[0].value).toBe(55.5);
  });
});

describe('safeListSort', () => {
  it("sort 'value' + khong quyen -> ep ve 'priority'", () => {
    expect(safeListSort('value', false)).toBe('priority');
  });

  it("sort 'value' + co quyen -> giu 'value'", () => {
    expect(safeListSort('value', true)).toBe('value');
  });

  it('sort khac value khong doi', () => {
    expect(safeListSort('spi', false)).toBe('spi');
  });
});

describe('isMoneyAlert', () => {
  it("ruleCode 'ar_overdue' -> true", () => {
    expect(isMoneyAlert({ ruleCode: 'ar_overdue', ruleTriggered: 'x' })).toBe(true);
  });

  it("ruleCode null + ruleTriggered bat dau 'Cong no qua han' -> true (du lieu cu)", () => {
    expect(isMoneyAlert({ ruleCode: null, ruleTriggered: 'Công nợ quá hạn > 5% HĐ' })).toBe(true);
  });

  it("ruleCode 'spi_low' -> false", () => {
    expect(isMoneyAlert({ ruleCode: 'spi_low', ruleTriggered: 'SPI thap' })).toBe(false);
  });
});

describe('maskAlertMessage', () => {
  const alert = { ruleCode: 'ar_overdue', ruleTriggered: 'Công nợ quá hạn > 5% HĐ', message: 'Công nợ 12.5 tỷ' };

  it('alert tien + khong quyen -> thay message bang hiddenText', () => {
    expect(maskAlertMessage(alert, false, 'AN')).toEqual({ ...alert, message: 'AN' });
  });

  it('alert tien + co quyen -> giu nguyen message', () => {
    expect(maskAlertMessage(alert, true, 'AN').message).toBe(alert.message);
  });

  it('alert khong lien quan tien -> giu nguyen du khong quyen', () => {
    const other = { ruleCode: 'spi_low', ruleTriggered: 'SPI thap', message: 'SPI 0.8' };
    expect(maskAlertMessage(other, false, 'AN')).toEqual(other);
  });
});
