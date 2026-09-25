import { describe, expect, it } from 'vitest';
import { dailyImportFileSchema, importFileSchema } from './validation';

/**
 * Kiem thu doc lap Task 2 (10MB) - kiem tra CONG THUC tai tang zod schema (noi thuc su chan
 * request server action), khong chi ham `isImportTooBig` thuan (da co `import-limits.test.ts`)
 * hay ca "vuot 10MB" (da co `actions-security.test.ts`). O day kiem RIENG khoang GIUA 1MB-10MB
 * phai QUA duoc (khong bi tu choi vi ly do dung luong), dung yeu cau cua nhiem vu.
 */
describe('importFileSchema (import Excel /import) - bien dung luong', () => {
  it('1MB -> qua (khong loi size)', () => {
    const r = importFileSchema.safeParse({ name: 'ds.xlsx', size: 1 * 1024 * 1024 });
    expect(r.success).toBe(true);
  });

  it('5MB (giua khoang) -> qua', () => {
    const r = importFileSchema.safeParse({ name: 'ds.xlsx', size: 5 * 1024 * 1024 });
    expect(r.success).toBe(true);
  });

  it('dung 10MB -> qua (bien duoi cua "vuot qua")', () => {
    const r = importFileSchema.safeParse({ name: 'ds.xlsx', size: 10 * 1024 * 1024 });
    expect(r.success).toBe(true);
  });

  it('10MB + 1 byte -> bi tu choi, thong diep loi ro rang co "10MB"', () => {
    const r = importFileSchema.safeParse({ name: 'ds.xlsx', size: 10 * 1024 * 1024 + 1 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/10MB/);
  });
});

describe('dailyImportFileSchema (import Nhan luc & Thiet bi /nhap-lieu) - cung bien nhu importFileSchema', () => {
  it('5MB -> qua', () => {
    expect(dailyImportFileSchema.safeParse({ name: 'nl.xlsx', size: 5 * 1024 * 1024 }).success).toBe(true);
  });

  it('10MB + 1 byte -> tu choi', () => {
    const r = dailyImportFileSchema.safeParse({ name: 'nl.xlsx', size: 10 * 1024 * 1024 + 1 });
    expect(r.success).toBe(false);
  });
});
