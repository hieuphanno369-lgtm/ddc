import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P7-C1 7.1: chuc nang "xoa toan bo du lieu" da go han (chu du an chot 2026-09-26),
 * khong con nut, action, ham repo hay key i18n nao dan toi hanh vi nay.
 */
const ROOT = process.cwd();
const src = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

describe('7.1 - khong con duong nao xoa toan bo du lieu', () => {
  it('khong con component ResetDataButton', () => {
    expect(existsSync(join(ROOT, 'src/components/admin/ResetDataButton.tsx'))).toBe(false);
  });
  it('trang /admin khong import/render ResetDataButton', () => {
    expect(src('app/[locale]/(app)/admin/page.tsx')).not.toMatch(/ResetDataButton/);
  });
  it('actions.ts khong con resetDataAction', () => {
    expect(src('src/server/actions.ts')).not.toMatch(/resetDataAction|resetAllData/);
  });
  it('prisma-repo va mock-repo khong con resetAllData', () => {
    expect(src('src/server/repo/prisma-repo.ts')).not.toMatch(/resetAllData/);
    expect(src('src/server/repo/mock-repo.ts')).not.toMatch(/resetAllData/);
  });
  it('vi/en khong con admin.resetData, admin.resetConfirm; van giu activity.reset_data cho nhat ky cu', () => {
    for (const f of ['src/i18n/messages/vi.json', 'src/i18n/messages/en.json']) {
      const m = JSON.parse(src(f)) as { admin: Record<string, unknown>; activity: Record<string, unknown> };
      expect(m.admin).not.toHaveProperty('resetData');
      expect(m.admin).not.toHaveProperty('resetConfirm');
      expect(m.activity).toHaveProperty('reset_data');
    }
  });
});
