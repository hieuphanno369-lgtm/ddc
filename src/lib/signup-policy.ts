import { normalizeEmail } from './login-policy';

/**
 * P3F-3 (Q2 = c, chủ dự án chốt 2026-09-29) - công ty dùng cả hai đuôi email. Khớp NGUYÊN đuôi:
 * không nhận tên miền con, không nhận đuôi dài hơn.
 */
export const COMPANY_EMAIL_DOMAINS: readonly string[] = ['daidung.vn', 'daidung.com.vn'];

const LOCAL_PART = /^[a-z0-9._%+-]{1,64}$/;

/** `normalizeEmail` rồi so khớp phần tên với `LOCAL_PART` và phần đuôi với đúng 1 đuôi trong danh sách. */
export function isCompanyEmail(raw: unknown): boolean {
  const email = normalizeEmail(raw);
  if (!email) return false;
  const [local, domain] = email.split('@');
  return LOCAL_PART.test(local) && COMPANY_EMAIL_DOMAINS.includes(domain);
}
