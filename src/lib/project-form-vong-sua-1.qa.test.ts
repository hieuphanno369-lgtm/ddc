/**
 * Tester (vong sua 1, muc 2, kiem thu doc lap): bo sung bien duoi cho `validateAliasChange`
 * ma `project-form.test.ts` (coder) chua cham - khoang trang thuan tuy, thu tu uu tien loi
 * (required phai thang loi_short/code_invalid khi ca hai deu co the dung), va lam tron.
 */
import { describe, expect, it } from 'vitest';
import { emptyProjectForm, validateAliasChange, type ProjectFormState } from './project-form';

const FULL_FORM: ProjectFormState = {
  ...emptyProjectForm(),
  currentAliasCode: 'CT-GOC',
  projectName: 'DU AN MAU QA',
  customerId: '1',
  teamKdId: '1',
};

describe('validateAliasChange - bien duoi vong sua 1', () => {
  it('doi ma sang CHUOI TOAN KHOANG TRANG (khong phai rong tuyet doi) -> van la "required" (trim truoc khi kiem)', () => {
    const f = { ...FULL_FORM, currentAliasCode: '   ' };
    expect(validateAliasChange(FULL_FORM, f, 'ly do hop le du dai')).toBe('required');
  });

  it('ma moi rong VA ly do cung rong -> uu tien bao "required" (ve ma) truoc, khong phai "reason_short"', () => {
    const f = { ...FULL_FORM, currentAliasCode: '' };
    expect(validateAliasChange(FULL_FORM, f, '')).toBe('required');
  });

  it('ma moi khong hop le (co khoang trang o giua) VA ly do cung rong -> bao "code_invalid" (kiem dinh dang ma truoc ly do)', () => {
    const f = { ...FULL_FORM, currentAliasCode: 'CT MOI KHONG HOP LE' };
    expect(validateAliasChange(FULL_FORM, f, '')).toBe('code_invalid');
  });

  it('ly do co khoang trang dau/cuoi nhung phan chu thuc chi 3 ky tu -> van la "reason_short" (trim truoc khi dem do dai)', () => {
    const f = { ...FULL_FORM, currentAliasCode: 'CT-MOI-HOP-LE' };
    expect(validateAliasChange(FULL_FORM, f, '   ab   ')).toBe('reason_short');
  });

  it('ma moi CHINH LA ma cu nhung viet hoa/thuong khac (vd "ct-goc" thay vi "CT-GOC") -> VAN duoc coi la "da doi" (so sanh CHINH XAC, khong so khong phan biet hoa thuong o day)', () => {
    // Ghi lai hanh vi hien tai: validateAliasChange so sanh f.currentAliasCode === base.currentAliasCode
    // (phan biet hoa thuong) - khac voi tang server (isProjectCodeTaken so khong phan biet hoa thuong).
    // Neu nguoi dung go lai dung ma cu nhung khac hoa/thuong, client se doi hoi ly do (server se tu choi
    // vi trung ma) - khong phai loi, chi la 2 tang kiem khac muc dich nhau (client: "co doi khong",
    // server: "co trung ai khong").
    const f = { ...FULL_FORM, currentAliasCode: 'ct-goc' };
    expect(validateAliasChange(FULL_FORM, f, '')).toBe('reason_short');
    expect(validateAliasChange(FULL_FORM, f, 'ly do hop le')).toBeNull();
  });

  it('khong doi gi (giu nguyen ca form) -> null bat ke ly do la gi (kem ly do rong)', () => {
    expect(validateAliasChange(FULL_FORM, FULL_FORM, '')).toBeNull();
    expect(validateAliasChange(FULL_FORM, FULL_FORM, 'bat ky')).toBeNull();
  });
});
