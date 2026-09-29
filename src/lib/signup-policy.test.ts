import { describe, expect, it } from 'vitest';
import { COMPANY_EMAIL_DOMAINS, isCompanyEmail } from './signup-policy';

describe('isCompanyEmail (Q2 = c: nhan ca @daidung.vn va @daidung.com.vn)', () => {
  it('danh sach duoi', () => {
    expect([...COMPANY_EMAIL_DOMAINS]).toEqual(['daidung.vn', 'daidung.com.vn']);
  });

  it.each([
    'ten@daidung.vn',
    'Ten.A@DaiDung.VN',
    '  ten@daidung.vn  ',
    'ten@daidung.com.vn',
    'a+b_c-d%e.f@daidung.com.vn',
  ])('nhan %j', (raw) => {
    expect(isCompanyEmail(raw)).toBe(true);
  });

  it.each([
    'ten@daidung.vn.x.com',
    'ten@sub.daidung.vn',
    'ten@sub.daidung.com.vn',
    'ten@xdaidung.vn',
    'ten@xdaidung.com.vn',
    'ten@daidung.com',
    'ten@gmail.com',
    '@daidung.vn',
    'a@b@daidung.vn',
    'ten@daidung.vn.',
    'ten daidung.vn',
    'te n@daidung.vn',
    `${'a'.repeat(65)}@daidung.vn`,
    `${'a'.repeat(240)}@daidung.vn`,
    'a'.repeat(255),
    '',
    null,
    undefined,
    123,
  ])('tu choi %j', (raw) => {
    expect(isCompanyEmail(raw)).toBe(false);
  });
});
