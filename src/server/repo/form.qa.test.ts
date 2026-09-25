import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from './mock-repo';
import { todayIso } from '@/lib/clock';

/**
 * Kiem thu doc lap cua Tester cho repo P3A (G-3/G-5) - khong lap lai kich ban trong `form.test.ts`
 * cua coder, chi them: so khong phan biet hoa/thuong (chu dinh Q4), trung voi ALIAS (khong phai
 * masterCode/currentAliasCode) cua du an khac, va createDimValue trung ten khong doi co needsReview.
 */
beforeEach(() => repo.reset());

describe('isProjectCodeTaken - khong phan biet hoa/thuong (Q4)', () => {
  it('ma VIET HOA cua du an khac van bi coi la trung', () => {
    const p2 = repo.getProject(2)!;
    const upper = p2.currentAliasCode.toUpperCase();
    const lower = p2.currentAliasCode.toLowerCase();
    expect(repo.isProjectCodeTaken(upper, 1)).toBe(true);
    expect(repo.isProjectCodeTaken(lower, 1)).toBe(true);
  });

  it('trung voi ALIAS (khong phai currentAliasCode) cua du an khac -> true', () => {
    // Doi ma du an 2 de no co 1 dong alias cu (khong con la currentAliasCode) - dung lam "alias" test.
    const oldCodeOfP2 = repo.getProject(2)!.currentAliasCode;
    repo.changeProjectCode(2, 'CT-P2-MOI', 'doi de tao dong alias cu', 'admin@x', todayIso());
    // oldCodeOfP2 gio chi con la 1 dong alias (da dong) cua du an 2, khong phai currentAliasCode nua.
    expect(repo.getProject(2)!.currentAliasCode).not.toBe(oldCodeOfP2);
    expect(repo.isProjectCodeTaken(oldCodeOfP2, 1)).toBe(true);
    // Nhung du an 2 tu dung lai ma cu cua chinh no thi khong bi chan (exceptProjectId = 2).
    expect(repo.isProjectCodeTaken(oldCodeOfP2, 2)).toBe(false);
  });

  it('ma trung nhung la CUA CHINH du an dang xet -> false du viet hoa/thuong khac nhau', () => {
    const p1 = repo.getProject(1)!;
    expect(repo.isProjectCodeTaken(p1.currentAliasCode.toUpperCase(), 1)).toBe(false);
  });
});

describe('createDimValue - trung ten/alias tra ve id cu, khong doi co needsReview', () => {
  it('data-entry tao CDT trung ten voi ban ghi da duyet -> tra id cu, needsReview VAN false', () => {
    const existing = repo.getDimFieldValues('customer')[0];
    const id = repo.createDimValue('customer', existing.name.toUpperCase(), { needsReview: true, by: 'pm@daidung.com.vn' });
    expect(id).toBe(existing.id);
    const row = repo.getDimFieldValues('customer').find((c) => c.id === id);
    expect(row?.needsReview).toBe(false); // khong bi ghi de thanh true chi vi trung ten
  });

  it('ten hoan toan moi -> tao ban ghi moi, needsReview theo opts', () => {
    const before = repo.getDimFieldValues('customer').length;
    const id = repo.createDimValue('customer', 'CDT HOAN TOAN MOI QA', { needsReview: true, by: 'pm@daidung.com.vn' });
    const after = repo.getDimFieldValues('customer');
    expect(after.length).toBe(before + 1);
    expect(after.find((c) => c.id === id)?.needsReview).toBe(true);
  });
});

describe('changeProjectCode - snapshot project_history chup dung du lieu TRUOC khi doi', () => {
  it('snapshot.currentAliasCode la ma CU, khong phai ma moi', () => {
    const oldCode = repo.getProject(1)!.currentAliasCode;
    repo.changeProjectCode(1, 'CT-SNAPSHOT-QA', 'kiem tra snapshot', 'admin@x', todayIso());
    const hist = repo.getProjectHistory().filter((h) => h.note.includes('currentAliasCode')).pop()!;
    expect((hist.snapshot as { currentAliasCode: string }).currentAliasCode).toBe(oldCode);
  });
});
