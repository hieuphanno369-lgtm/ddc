/**
 * Tester (vong sua 1, muc 6/S-2, kiem thu doc lap): `isReservedProjectCode` chua co unit test
 * truc tiep nao (chi duoc kiem gian tiep qua `actions-project.test.ts` voi 1 ca 'M-00099').
 * File nay kiem ham THUAN doc lap voi nhieu bien the hoa/thuong, khoang trang, va dang khong khop
 * mau de chac chan quy tac "chi chan dung mau M-<so>, tru khi la masterCode cua chinh du an" dung
 * nhu chu thich cua coder, khong rong hon hoac hep hon.
 */
import { describe, expect, it } from 'vitest';
import { isReservedProjectCode, isValidProjectCode, RESERVED_MASTER_CODE_RE } from './project-code';

describe('isReservedProjectCode (S-2, vong sua 1)', () => {
  it('dung mau M-<so> (hoa) khong phai masterCode cua ai -> bi chan', () => {
    expect(isReservedProjectCode('M-00099')).toBe(true);
  });

  it('dung mau nhung VIET THUONG (m-00099) -> van bi chan (khong phan biet hoa/thuong)', () => {
    expect(isReservedProjectCode('m-00099')).toBe(true);
  });

  it('dung mau nhung it chu so hon (M-1, khong co so 0 dem) -> van bi chan (\\d+ khop moi do dai)', () => {
    expect(isReservedProjectCode('M-1')).toBe(true);
  });

  it('co khoang trang thua quanh ma -> van duoc trim truoc khi kiem, van bi chan', () => {
    expect(isReservedProjectCode('  M-00099  ')).toBe(true);
  });

  it('dung masterCode CHINH dự an dang sua (khong phan biet hoa/thuong) -> KHONG bi chan (duoc quay ve ma goc)', () => {
    expect(isReservedProjectCode('M-00017', 'M-00017')).toBe(false);
    expect(isReservedProjectCode('m-00017', 'M-00017')).toBe(false);
  });

  it('dung mau nhung la masterCode cua DU AN KHAC (khong phai ownMasterCode truyen vao) -> van bi chan', () => {
    expect(isReservedProjectCode('M-00099', 'M-00017')).toBe(true);
  });

  it('khong dung mau M-<so> (co chu sau so, hoac khong co dau gach) -> KHONG bi chan (qua duoc, khong chan oan)', () => {
    expect(isReservedProjectCode('M-00099A')).toBe(false);
    expect(isReservedProjectCode('M00099')).toBe(false);
    expect(isReservedProjectCode('MM-00099')).toBe(false);
    expect(isReservedProjectCode('CT-M-00099')).toBe(false);
  });

  it('ma binh thuong cua khach hang (vd "10626-008") -> KHONG bi chan', () => {
    expect(isReservedProjectCode('10626-008')).toBe(false);
  });

  it('regex export RESERVED_MASTER_CODE_RE khop dung dinh nghia "^M-\\d+$" khong phan biet hoa thuong', () => {
    expect(RESERVED_MASTER_CODE_RE.test('M-1')).toBe(true);
    expect(RESERVED_MASTER_CODE_RE.test('M-')).toBe(false);
    expect(RESERVED_MASTER_CODE_RE.test('M-1x')).toBe(false);
  });

  it('ma dang M-00099 van la 1 ma hop le theo isValidProjectCode (viec chan la o tang isReservedProjectCode, khong phai o isValidProjectCode)', () => {
    // Ghi lai chu dinh cua coder: schema/isValidProjectCode GIU NGUYEN regex cu, viec chan mau
    // M-<so> chi ap dung o tang changeProjectCodeAction (goi isReservedProjectCode rieng).
    expect(isValidProjectCode('M-00099')).toBe(true);
  });
});
