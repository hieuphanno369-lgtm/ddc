import { describe, expect, it } from 'vitest';
import { validateStageWeights } from '@/lib/stages';
import { STAGE_WEIGHT_PRESETS, presetWeightsFor } from './stage-weight-presets';
import type { ProjectType } from '@/server/repo/types';

const TYPES: ProjectType[] = ['EPC', 'San_van_dong', 'San_bay', 'Nha_xuong', 'Cau_cang', 'Cao_tang', 'Dong_tau', 'Cau_giao_thong', 'Khac'];

describe('STAGE_WEIGHT_PRESETS', () => {
  it.each(TYPES)('%s - hop le, du 7 ma khac nhau, tong 100%%', (type) => {
    const rows = STAGE_WEIGHT_PRESETS[type];
    expect(rows).toHaveLength(7);
    expect(new Set(rows.map((r) => r.stageCode)).size).toBe(7);
    expect(validateStageWeights(rows).ok).toBe(true);
  });

  it('Khac bang DEFAULT_STAGE_WEIGHTS', () => {
    const rows = STAGE_WEIGHT_PRESETS.Khac;
    expect(rows.map((r) => [r.stageCode, r.weightPct, r.applicable])).toEqual([
      ['design', 5, true], ['shop', 10, true], ['procurement', 10, true], ['fabrication', 40, true],
      ['transport', 5, true], ['erection', 27, true], ['handover', 3, true],
    ]);
  });
});

describe('presetWeightsFor', () => {
  it('chuoi rong -> giong DEFAULT_STAGE_WEIGHTS', () => {
    expect(presetWeightsFor('')).toEqual(STAGE_WEIGHT_PRESETS.Khac);
  });

  it('EPC -> dung bang STAGE_WEIGHT_PRESETS.EPC', () => {
    expect(presetWeightsFor('EPC')).toEqual(STAGE_WEIGHT_PRESETS.EPC);
  });
});
