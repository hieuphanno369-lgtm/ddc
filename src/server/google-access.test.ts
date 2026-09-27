import { describe, expect, it } from 'vitest';
import { googleAccessDecision } from './google-access';

/**
 * S9 - Google chi vao khi email da xac minh, co trong danh sach admin them, dang hoat dong,
 * chua bi khoa. Ham thuan (khong dong DB) de test doc lap voi callback next-auth.
 */
describe('googleAccessDecision', () => {
  it('chua xac minh email -> unverified', () => {
    expect(googleAccessDecision({ email: 'a@daidung.com.vn', email_verified: false }, null)).toBe('unverified');
    expect(googleAccessDecision({ email: 'a@daidung.com.vn', email_verified: undefined }, null)).toBe('unverified');
  });

  it('email co, tai khoan null -> not_found', () => {
    expect(googleAccessDecision({ email: 'la@daidung.com.vn', email_verified: true }, null)).toBe('not_found');
  });

  it('isActive=false -> inactive', () => {
    expect(
      googleAccessDecision({ email: 'a@daidung.com.vn', email_verified: true }, { isActive: false, lockedAt: null }),
    ).toBe('inactive');
  });

  it('lockedAt co gia tri -> locked', () => {
    expect(
      googleAccessDecision(
        { email: 'a@daidung.com.vn', email_verified: true },
        { isActive: true, lockedAt: '2026-09-27T00:00:00Z' },
      ),
    ).toBe('locked');
  });

  it('du dieu kien -> allow', () => {
    expect(
      googleAccessDecision({ email: 'a@daidung.com.vn', email_verified: true }, { isActive: true, lockedAt: null }),
    ).toBe('allow');
  });

  it('email hoa/thuong khac nhau van so theo chu thuong (ham goi phia ngoai da lower)', () => {
    // googleAccessDecision khong tu ha chu email - caller phai lower() truoc khi tim account va
    // truyen vao day; test nay ghi ro quy uoc do de khong ai vo tinh sua nguoc lai.
    expect(
      googleAccessDecision({ email: 'A@Daidung.com.vn', email_verified: true }, { isActive: true, lockedAt: null }),
    ).toBe('allow');
  });
});
