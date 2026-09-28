import { describe, it, expect, beforeEach } from 'vitest';
import { repo } from './mock-repo';
import { SEED_STAGE_CODES } from '@/lib/stages';

/** 7 mã giai đoạn cũ (trước settlement) - chỉ để dựng dữ liệu test. */
const LEGACY7_STAGE_CODES = SEED_STAGE_CODES.slice(0, 7);

beforeEach(() => repo.reset());

describe('chuỗi giá trị 7 giai đoạn', () => {
  it('saveValueChain ghi đủ 7 dòng, đúng pctComplete/applicable', () => {
    const p = repo.listProjects()[0];
    const rows = LEGACY7_STAGE_CODES.map((stageCode, i) => ({
      stageCode,
      pctComplete: (i + 1) / 10,
      applicable: i !== 0, // design không áp dụng
    }));

    repo.saveValueChain(p.id, '2026-09', rows);
    const chain = repo.getValueChain(p.id, '2026-09');

    expect(chain.length).toBe(7);
    expect(chain.find((c) => c.stageCode === 'design')!.applicable).toBe(false);
    expect(chain.find((c) => c.stageCode === 'shop')!.pctComplete).toBe(0.2);
    expect(chain.every((c) => c.applicable === (c.stageCode !== 'design'))).toBe(true);
  });

  it('saveValueChain ghi đè 7 dòng của cùng tháng (không nhân bản)', () => {
    const p = repo.listProjects()[0];
    const rows = LEGACY7_STAGE_CODES.map((stageCode) => ({ stageCode, pctComplete: 0.5, applicable: true }));
    repo.saveValueChain(p.id, '2026-08', rows);
    repo.saveValueChain(p.id, '2026-08', rows);

    expect(repo.getValueChain(p.id, '2026-08').length).toBe(7);
  });

  it('saveMonthlyFact ghi bottleneckStage', () => {
    const p = repo.listProjects()[0];
    repo.saveMonthlyFact(p.id, '2026-09', { pctActual: 0.5, bottleneckStage: 'erection' });

    expect(repo.getLatestFact(p.id, '2026-09')!.bottleneckStage).toBe('erection');
  });
});

describe('saveValueChain - idempotent & cô lập theo tháng', () => {
  const rows = (pct: number, applicable: (s: string) => boolean = () => true) =>
    LEGACY7_STAGE_CODES.map((stageCode) => ({ stageCode, pctComplete: pct, applicable: applicable(stageCode) }));

  it('lưu lại cùng tháng CẬP NHẬT giá trị cũ, không nhân bản, không để lại bản ghi cũ', () => {
    const p = repo.listProjects()[0];
    repo.saveValueChain(p.id, '2026-09', rows(0.1));
    repo.saveValueChain(p.id, '2026-09', rows(0.9, (s) => s !== 'design'));

    const chain = repo.getValueChain(p.id, '2026-09');
    expect(chain.length).toBe(7);
    expect(chain.every((c) => c.pctComplete === 0.9)).toBe(true);
    expect(chain.find((c) => c.stageCode === 'design')!.applicable).toBe(false);
    expect(chain.find((c) => c.stageCode === 'shop')!.applicable).toBe(true);
  });

  it('lưu tháng khác KHÔNG đụng 7 dòng của tháng cũ', () => {
    const p = repo.listProjects()[0];
    repo.saveValueChain(p.id, '2026-08', rows(0.2));
    repo.saveValueChain(p.id, '2026-09', rows(0.7));

    expect(repo.getValueChain(p.id, '2026-08').length).toBe(7);
    expect(repo.getValueChain(p.id, '2026-08').every((c) => c.pctComplete === 0.2)).toBe(true);
    expect(repo.getValueChain(p.id, '2026-09').length).toBe(7);
    expect(repo.getValueChain(p.id, '2026-09').every((c) => c.pctComplete === 0.7)).toBe(true);
  });

  it('lưu tháng khác không đụng chuỗi giá trị của DỰ ÁN khác', () => {
    const [pa, pb] = repo.listProjects();
    repo.saveValueChain(pa.id, '2026-09', rows(0.1));
    repo.saveValueChain(pb.id, '2026-09', rows(0.8));

    expect(repo.getValueChain(pa.id, '2026-09').every((c) => c.pctComplete === 0.1)).toBe(true);
    expect(repo.getValueChain(pb.id, '2026-09').every((c) => c.pctComplete === 0.8)).toBe(true);
  });

  it('0 giai đoạn áp dụng vẫn lưu đủ 7 dòng applicable=false (server không chặn)', () => {
    const p = repo.listProjects()[0];
    repo.saveValueChain(p.id, '2026-09', rows(0, () => false));

    const chain = repo.getValueChain(p.id, '2026-09');
    expect(chain.length).toBe(7);
    expect(chain.every((c) => c.applicable === false)).toBe(true);
  });
});

describe('saveMonthlyFact - bottleneckStage set/null', () => {
  it('set rồi XÓA về null khi tất cả giai đoạn đã xong', () => {
    const p = repo.listProjects()[0];
    repo.saveMonthlyFact(p.id, '2026-09', { bottleneckStage: 'erection' });
    expect(repo.getLatestFact(p.id, '2026-09')!.bottleneckStage).toBe('erection');

    repo.saveMonthlyFact(p.id, '2026-09', { bottleneckStage: null });
    expect(repo.getLatestFact(p.id, '2026-09')!.bottleneckStage).toBeNull();
  });

  it('KHÔNG truyền bottleneckStage → giữ nguyên giá trị cũ (không xoá nhầm)', () => {
    const p = repo.listProjects()[0];
    repo.saveMonthlyFact(p.id, '2026-09', { bottleneckStage: 'shop' });
    repo.saveMonthlyFact(p.id, '2026-09', { pctActual: 0.3 });

    expect(repo.getLatestFact(p.id, '2026-09')!.bottleneckStage).toBe('shop');
  });
});

describe('Excel import GIỮ NGUYÊN - không đụng 7 giai đoạn', () => {
  it('importMonthlyFacts ghi pctActual trực tiếp, value chain của tháng không đổi', () => {
    const p = repo.listProjects()[0];
    const before = repo.getValueChain(p.id, '2026-09').map((v) => ({ ...v }));

    const r = repo.importMonthlyFacts('2026-09', [{ projectId: p.id, pctActual: 0.42 }]);

    expect(r.imported).toBe(1);
    expect(repo.getLatestFact(p.id, '2026-09')!.pctActual).toBe(0.42);
    // 7 giai đoạn giữ nguyên y hệt trước import (số dòng lẫn giá trị)
    expect(repo.getValueChain(p.id, '2026-09')).toEqual(before);
  });

  it('du an moi chua co fact nao - importMonthlyFacts tu tao dong moi', () => {
    const created = repo.createProject({
      projectName: 'Du an import moi', customerId: 1, teamKdId: 1, marketCode: 'TN',
      projectType: 'EPC', priority: 'P1', contractValue: 50,
    });

    const r = repo.importMonthlyFacts('2026-09', [{ projectId: created.id, pctActual: 0.55 }]);

    expect(r.imported).toBe(1);
    expect(r.failed).toEqual([]);
    expect(repo.getLatestFact(created.id, '2026-09')!.pctActual).toBe(0.55);
  });
});
