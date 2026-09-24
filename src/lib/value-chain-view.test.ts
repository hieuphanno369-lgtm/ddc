import { describe, expect, it } from 'vitest';
import type { ProjectStageWeight } from '@/server/repo/types';
import { stageWeightLabel } from './value-chain-view';

const W = (stageCode: ProjectStageWeight['stageCode'], weightPct: number, applicable = true): ProjectStageWeight => ({
  projectId: 1,
  stageCode,
  weightPct,
  applicable,
});

describe('stageWeightLabel', () => {
  it('so nguyen: "40%"', () => {
    expect(stageWeightLabel([W('fabrication', 40)], 'fabrication', 'vi')).toBe('40%');
  });

  it('so le vi: dau phay thap phan "33,3%"', () => {
    expect(stageWeightLabel([W('shop', 33.333)], 'shop', 'vi')).toBe('33,3%');
  });

  it('so le en: dau cham "33.3%"', () => {
    expect(stageWeightLabel([W('shop', 33.333)], 'shop', 'en')).toBe('33.3%');
  });

  it('applicable=false -> "-"', () => {
    expect(stageWeightLabel([W('design', 5, false)], 'design', 'vi')).toBe('-');
  });

  it('khong co dong nao cho stage -> "-"', () => {
    expect(stageWeightLabel([W('shop', 10)], 'design', 'vi')).toBe('-');
  });
});
