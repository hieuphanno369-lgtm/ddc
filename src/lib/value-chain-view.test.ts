import { describe, expect, it } from 'vitest';
import type { ProjectStageWeight } from '@/server/repo/types';
import type { WorkItemCompare, WorkItemCompareRow } from '@/lib/stage-timeline';
import { stageTonnage, stageWeightLabel } from './value-chain-view';

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

const ROW = (planned: number, actual: number): WorkItemCompareRow => ({ workItemId: 1, name: 'x', planned, actual });

describe('stageTonnage', () => {
  it('2 dong -> cong dung KH/TT', () => {
    const compare: WorkItemCompare = { fabrication: [ROW(100, 80), ROW(50, 40)] };
    expect(stageTonnage(compare, 'fabrication')).toEqual({ planned: 150, actual: 120 });
  });

  it('stage khong co key (vd design - thu cong) -> null', () => {
    const compare: WorkItemCompare = { fabrication: [ROW(100, 80)] };
    expect(stageTonnage(compare, 'design')).toBeNull();
  });

  it('mang rong -> null', () => {
    const compare: WorkItemCompare = { fabrication: [] };
    expect(stageTonnage(compare, 'fabrication')).toBeNull();
  });
});
