import { describe, expect, it } from 'vitest';
import { SEED_STAGE_CODES, validateStageWeights } from '@/lib/stages';
import { STAGE_WEIGHT_PRESETS, presetWeightsFor } from './stage-weight-presets';
import type { ProjectType } from '@/server/repo/types';

const TYPES: ProjectType[] = ['EPC', 'San_van_dong', 'San_bay', 'Nha_xuong', 'Cau_cang', 'Cao_tang', 'Dong_tau', 'Cau_giao_thong', 'Khac'];

describe('STAGE_WEIGHT_PRESETS (P7-C2: 8 ma, dung thu tu SEED_STAGE_CODES)', () => {
  it.each(TYPES)('%s - hop le, du 8 ma khac nhau dung thu tu SEED_STAGE_CODES, tong 100%%', (type) => {
    const rows = STAGE_WEIGHT_PRESETS[type];
    expect(rows).toHaveLength(8);
    expect(rows.map((r) => r.stageCode)).toEqual([...SEED_STAGE_CODES]);
    expect(new Set(rows.map((r) => r.stageCode)).size).toBe(8);
    expect(validateStageWeights(rows).ok).toBe(true);
  });

  it('Khac bang DEFAULT_STAGE_WEIGHTS (5/10/10/40/5/25/3/2)', () => {
    const rows = STAGE_WEIGHT_PRESETS.Khac;
    expect(rows.map((r) => [r.stageCode, r.weightPct, r.applicable])).toEqual([
      ['design', 5, true], ['shop', 10, true], ['procurement', 10, true], ['fabrication', 40, true],
      ['transport', 5, true], ['erection', 25, true], ['handover', 3, true], ['settlement', 2, true],
    ]);
  });

  it.each([
    ['EPC', [8, 10, 15, 32, 5, 25, 3, 2]],
    ['San_bay', [4, 8, 8, 42, 5, 28, 3, 2]],
    ['San_van_dong', [5, 10, 8, 38, 6, 28, 3, 2]],
    ['Nha_xuong', [3, 7, 20, 38, 5, 22, 3, 2]],
    ['Cau_cang', [5, 10, 10, 38, 10, 22, 3, 2]],
    ['Cao_tang', [5, 12, 10, 35, 5, 28, 3, 2]],
    ['Dong_tau', [8, 12, 15, 45, 2, 13, 3, 2]],
    ['Cau_giao_thong', [6, 10, 10, 37, 8, 24, 3, 2]],
  ] as [ProjectType, number[]][])('%s dung dung so da chot', (type, pcts) => {
    expect(STAGE_WEIGHT_PRESETS[type].map((r) => r.weightPct)).toEqual(pcts);
  });
});

describe('presetWeightsFor', () => {
  it('chuoi rong -> giong DEFAULT_STAGE_WEIGHTS', () => {
    expect(presetWeightsFor('')).toEqual(STAGE_WEIGHT_PRESETS.Khac);
  });

  it('EPC -> dung bang STAGE_WEIGHT_PRESETS.EPC', () => {
    expect(presetWeightsFor('EPC')).toEqual(STAGE_WEIGHT_PRESETS.EPC);
  });

  it("EPC + order co them 'custom_1' -> custom_1 duoc dien 0% ap dung, van hop le", () => {
    const order = [...SEED_STAGE_CODES, 'custom_1'];
    const rows = presetWeightsFor('EPC', order);
    expect(rows.map((r) => r.stageCode)).toEqual(order);
    const custom = rows.find((r) => r.stageCode === 'custom_1')!;
    expect(custom).toEqual({ stageCode: 'custom_1', weightPct: 0, applicable: true });
    expect(validateStageWeights(rows).ok).toBe(true);
  });
});
