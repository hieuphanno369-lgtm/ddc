import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** P4 (Task E1/E2): key i18n mới nằm trong nhóm riêng ở cuối file, vi/en cùng tập key, không dùng dấu gạch dài. */
const read = (f: string) => JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/messages', f), 'utf-8')) as Record<string, Record<string, unknown>>;
const vi = read('vi.json');
const en = read('en.json');

const GROUPS = ['period', 'filterChip', 'asOf', 'kpiGroup', 'scheduleGapSentence', 'chartHowTo', 'helpTip', 'backfill'];
const HELP_KEYS = [
  'ovPeriod', 'ovInPeriod', 'ovInProgress', 'ovBehind', 'ovPenaltyRisk', 'ovPenalized', 'ovNotStarted', 'ovRevenue',
  'ovTonnage', 'ovSpiCpi', 'ovSCurve', 'ovStatus', 'ovCapacity',
  'dtAsOf', 'dtPctPlan', 'dtPctActual', 'dtSpi', 'dtCpi', 'dtResource', 'dtTimeline', 'dtValueChain', 'dtBottleneck',
  'dtMobilization', 'dtSCurve',
];

describe('i18n P4', () => {
  it('mỗi nhóm P4 có mặt ở cả vi và en với cùng tập key, giá trị không rỗng', () => {
    for (const g of GROUPS) {
      expect(Object.keys(vi[g] ?? {}).sort(), g).toEqual(Object.keys(en[g] ?? {}).sort());
      for (const [k, v] of Object.entries({ ...vi[g], ...en[g] })) expect(String(v).trim(), `${g}.${k}`).not.toBe('');
    }
  });

  it('helpTip phủ đủ chuỗi "?" của Tổng quan và Chi tiết', () => {
    for (const k of HELP_KEYS) {
      expect(vi.helpTip[k], k).toBeTruthy();
      expect(en.helpTip[k], k).toBeTruthy();
    }
  });

  it('các nhóm P4 không có dấu gạch dài (em/en dash)', () => {
    for (const g of GROUPS) expect(JSON.stringify([vi[g], en[g]])).not.toMatch(/[–—]/);
  });

  it('đổi tên đã duyệt (D-5, D-6, D-18) giữ nguyên TÊN key', () => {
    expect(vi.kpi.totalProjects).toBe('Dự án trong kỳ');
    expect(vi.kpi.backlog).toBe('HĐ chưa khởi công');
    expect(en.kpi.backlog).toBe('Contracts not started');
    expect(vi.detail.sCurve12).toBe('S-curve PV/EV/AC');
    expect(vi.detail.spiCpi12).toBe('Xu hướng SPI/CPI');
  });
});
