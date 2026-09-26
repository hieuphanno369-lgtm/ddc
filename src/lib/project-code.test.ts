import { describe, expect, it } from 'vitest';
import { isValidProjectCode, normalizeProjectCode, planAliasChange } from './project-code';
import type { ProjectAlias } from '@/server/repo/types';

describe('isValidProjectCode', () => {
  it('cac ma hop le', () => {
    expect(isValidProjectCode('DDC-2026-0147')).toBe(true);
    expect(isValidProjectCode('TSN/T3.KC_1')).toBe(true);
  });

  it('cac ma khong hop le', () => {
    expect(isValidProjectCode(' ')).toBe(false);
    expect(isValidProjectCode('A B')).toBe(false);
    expect(isValidProjectCode('A'.repeat(41))).toBe(false);
    expect(isValidProjectCode('-ABC')).toBe(false);
  });

  it('normalizeProjectCode trim khoang trang 2 dau', () => {
    expect(normalizeProjectCode('  ABC-1  ')).toBe('ABC-1');
  });
});

const alias = (over: Partial<ProjectAlias>): ProjectAlias => ({
  id: 1,
  projectId: 1,
  aliasCode: 'OLD-1',
  aliasType: 'Ma_CT',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  reason: 'seed',
  approvedBy: 'system',
  ...over,
});

describe('planAliasChange', () => {
  const commonArgs = {
    projectId: 1,
    oldCode: 'OLD-1',
    newCode: 'NEW-1',
    today: '2026-09-16',
    reason: 'doi theo hop dong moi',
    by: 'admin@daidung.com.vn',
    projectCreatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('co dong dang mo -> dong lai hom nay, mo dong moi tu mai', () => {
    const plan = planAliasChange({ ...commonArgs, aliases: [alias({ id: 5, effectiveTo: null })] });
    expect(plan.closeId).toBe(5);
    expect(plan.closeTo).toBe('2026-09-16');
    expect(plan.retypeId).toBeNull();
    expect(plan.insertOld).toBeNull();
    expect(plan.insertNew).toMatchObject({ aliasCode: 'NEW-1', effectiveFrom: '2026-09-17', effectiveTo: null });
  });

  it('doi lan 2 trong cung ngay -> sua ma dong cho, khong de them dong', () => {
    const plan = planAliasChange({
      ...commonArgs,
      aliases: [alias({ id: 7, aliasCode: 'NEW-1', effectiveFrom: '2026-09-17', effectiveTo: null })],
    });
    expect(plan.retypeId).toBe(7);
    expect(plan.closeId).toBeNull();
    expect(plan.insertOld).toBeNull();
    expect(plan.insertNew).toBeNull();
  });

  it('chua co alias nao -> chen ca dong cu (da dong) va dong moi', () => {
    const plan = planAliasChange({ ...commonArgs, aliases: [] });
    expect(plan.insertOld).toMatchObject({ aliasCode: 'OLD-1', effectiveFrom: '2026-01-01', effectiveTo: '2026-09-16' });
    expect(plan.insertNew).toMatchObject({ aliasCode: 'NEW-1', effectiveFrom: '2026-09-17', effectiveTo: null });
    expect(plan.closeId).toBeNull();
    expect(plan.retypeId).toBeNull();
  });
});
