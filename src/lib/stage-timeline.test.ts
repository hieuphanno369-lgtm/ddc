import { describe, expect, it } from 'vitest';
import { STAGE_ORDER } from '@/lib/stages';
import type { ProjectStageWeight, Stage, StageMilestoneView } from '@/server/repo/types';
import { buildStageTimelineRows, buildTimeDomain, defaultCompareStage, stageMarkers, xOf } from './stage-timeline';

const ms = (over: Partial<StageMilestoneView>): StageMilestoneView => ({
  projectId: 1, stageCode: 'design', plannedStart: null, plannedFinish: null, actualStart: null,
  actualFinish: null, forecastDate: null, dayVariance: null, updatedAt: '2026-09-16T00:00:00.000Z', updatedBy: 'x',
  ...over,
});
const w = (stageCode: (typeof STAGE_ORDER)[number], weightPct: number, applicable = true): ProjectStageWeight => ({
  projectId: 1, stageCode, weightPct, applicable,
});

describe('buildStageTimelineRows', () => {
  it('dung thu tu STAGE_ORDER, bo giai doan khong co dong milestone', () => {
    const milestones = [ms({ stageCode: 'design' }), ms({ stageCode: 'erection' })];
    const weights = STAGE_ORDER.map((s) => w(s, 10));
    const rows = buildStageTimelineRows(milestones, weights);
    expect(rows.map((r) => r.stageCode)).toEqual(['design', 'erection']);
  });

  it('weightPct null khi khong co dong trong so hoac applicable=false', () => {
    const milestones = [ms({ stageCode: 'design' }), ms({ stageCode: 'shop' })];
    const weights = [w('design', 10, false)];
    const rows = buildStageTimelineRows(milestones, weights);
    expect(rows.find((r) => r.stageCode === 'design')?.weightPct).toBeNull();
    expect(rows.find((r) => r.stageCode === 'shop')?.weightPct).toBeNull();
  });

  it('truyen order rieng -> duyet theo order do, khong theo STAGE_ORDER', () => {
    const milestones = [ms({ stageCode: 'settlement' }), ms({ stageCode: 'design' })];
    const rows = buildStageTimelineRows(milestones, [], ['settlement', 'design']);
    expect(rows.map((r) => r.stageCode)).toEqual(['settlement', 'design']);
  });
});

const ST = (code: string, over: Partial<Stage> = {}): Stage => ({
  code, nameVi: code, nameEn: code, sortOrder: 1, calcMode: 'manual', side: 'left', isActive: true, ...over,
});

describe('defaultCompareStage', () => {
  it("co fabrication dang dung -> 'fabrication'", () => {
    const stages = [ST('design', { sortOrder: 1 }), ST('fabrication', { sortOrder: 2, calcMode: 'volume' })];
    expect(defaultCompareStage(stages)).toBe('fabrication');
  });
  it('fabrication ngung dung -> giai doan volume dau tien', () => {
    const stages = [
      ST('design', { sortOrder: 1 }),
      ST('shop', { sortOrder: 2, calcMode: 'volume' }),
      ST('fabrication', { sortOrder: 3, calcMode: 'volume', isActive: false }),
    ];
    expect(defaultCompareStage(stages)).toBe('shop');
  });
  it('khong co giai doan volume nao -> giai doan dau tien', () => {
    const stages = [ST('design', { sortOrder: 2 }), ST('shop', { sortOrder: 1 })];
    expect(defaultCompareStage(stages)).toBe('shop');
  });
  it('rong -> null', () => {
    expect(defaultCompareStage([])).toBeNull();
  });
});

describe('buildTimeDomain', () => {
  it('tu ngay som nhat toi ngay muon nhat (gom hom nay), ticks dung', () => {
    const rows = buildStageTimelineRows(
      [ms({ stageCode: 'design', plannedStart: '2025-12-15', plannedFinish: '2026-01-10' }),
        ms({ stageCode: 'handover', plannedFinish: '2026-09-29' })],
      STAGE_ORDER.map((s) => w(s, 10)),
    );
    const d = buildTimeDomain(rows, '2026-09-16')!;
    expect(d.from).toBe('2025-12-01');
    expect(d.to).toBe('2026-09-30');
    expect(d.ticks[0]).toEqual({ date: '2025-12-01', label: null });
    expect(d.ticks[1].label).toBe('01/26');
  });

  it('khong co ngay nao -> null', () => {
    const rows = buildStageTimelineRows([ms({ stageCode: 'design' })], []);
    expect(buildTimeDomain(rows, '2026-09-16')).toBeNull();
  });

  it('hom nay sau moi ngay -> to la cuoi thang cua hom nay', () => {
    const rows = buildStageTimelineRows([ms({ stageCode: 'design', plannedFinish: '2026-01-10' })], []);
    const d = buildTimeDomain(rows, '2026-11-05')!;
    expect(d.to).toBe('2026-11-30');
  });
});

describe('xOf', () => {
  it('from -> x0; to -> x0+width', () => {
    const dom = { from: '2026-01-01', to: '2026-01-31', ticks: [] };
    expect(xOf('2026-01-01', dom, 10, 100)).toBe(10);
    expect(xOf('2026-01-31', dom, 10, 100)).toBe(110);
  });
});

describe('stageMarkers', () => {
  it('bo "du kien" khi da co ngay TT HT', () => {
    const rows = buildStageTimelineRows(
      [ms({ stageCode: 'design', plannedStart: '2026-01-01', plannedFinish: '2026-01-10', actualStart: '2026-01-01', actualFinish: '2026-01-12', forecastDate: '2026-01-20' })],
      [],
    );
    const keys = stageMarkers(rows[0]).map((m) => m.key);
    expect(keys).not.toContain('forecastDate');
    expect(keys).toEqual(['plannedStart', 'plannedFinish', 'actualStart', 'actualFinish']);
  });
  it('ngay null bi bo', () => {
    const rows = buildStageTimelineRows([ms({ stageCode: 'design', plannedStart: '2026-01-01' })], []);
    expect(stageMarkers(rows[0]).map((m) => m.key)).toEqual(['plannedStart']);
  });
});
