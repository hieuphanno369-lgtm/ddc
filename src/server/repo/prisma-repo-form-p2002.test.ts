/**
 * Coder (vong sua 1, vong 2 - N-1): `isP2002On` chi nhan P2002 khi `meta.target` DUNG bo cot cua index
 * can bat. Dinh dang target lay tu DB that (transaction tu rollback tren `ddc_control_tower`).
 */
import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { isP2002On, PROJECT_CODE_UNIQUE_TARGETS } from './prisma-repo-form';

const p2002 = (target?: unknown) => new Prisma.PrismaClientKnownRequestError('trung', {
  code: 'P2002', clientVersion: '6.19.3', ...(target !== undefined ? { meta: { target } } : {}),
});
const PIC = [['projectId']] as const;

describe('isP2002On (N-1)', () => {
  it('index ma CT: lower(currentAliasCode) va masterCode -> true', () => {
    expect(isP2002On(p2002(['lower(currentAliasCode)']), PROJECT_CODE_UNIQUE_TARGETS)).toBe(true);
    expect(isP2002On(p2002(['masterCode']), PROJECT_CODE_UNIQUE_TARGETS)).toBe(true);
  });

  it('partial index 1 PIC ["projectId"] -> true; khoa chinh ["projectId","userEmail"] (2 admin cung them 1 Backup) -> false', () => {
    expect(isP2002On(p2002(['projectId']), PIC)).toBe(true);
    expect(isP2002On(p2002(['projectId', 'userEmail']), PIC)).toBe(false);
  });

  it('khong co meta.target, target khong phai mang, ma loi khac P2002, loi thuong -> false', () => {
    expect(isP2002On(p2002(), PROJECT_CODE_UNIQUE_TARGETS)).toBe(false);
    expect(isP2002On(p2002('masterCode'), PROJECT_CODE_UNIQUE_TARGETS)).toBe(false);
    const p2025 = new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '6.19.3', meta: { target: ['masterCode'] } });
    expect(isP2002On(p2025, PROJECT_CODE_UNIQUE_TARGETS)).toBe(false);
    expect(isP2002On(new Error('P2002'), PROJECT_CODE_UNIQUE_TARGETS)).toBe(false);
  });
});
