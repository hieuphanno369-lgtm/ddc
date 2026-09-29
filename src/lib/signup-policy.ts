import { normalizeEmail } from './login-policy';

/**
 * P3F-3 (Q2 = c, chủ dự án chốt 2026-09-29) - công ty dùng cả hai đuôi email. Khớp NGUYÊN đuôi:
 * không nhận tên miền con, không nhận đuôi dài hơn.
 */
export const COMPANY_EMAIL_DOMAINS: readonly string[] = ['daidung.vn', 'daidung.com.vn'];

/**
 * S2 - họ tên không được chứa ký tự nhóm `\p{C}` (xuống dòng, điều khiển, zero-width, RTL...): chúng làm tên
 * hiển thị sai trong bảng admin và cho phép chèn nội dung giả vào email.
 * T2 (security vòng 2) - thêm các ký tự ngắt dòng hoặc tàng hình nằm ngoài nhóm C: U+2028/U+2029 (Zl, Zp),
 * U+034F (Mn) và các ký tự lấp chỗ Hangul hiển thị như khoảng trắng.
 */
const INVISIBLE_IN_NAME = /[\p{C}\p{Zl}\p{Zp}\u034F\u115F\u1160\u3164\uFFA0]/u;

export function hasInvisibleChars(name: string): boolean {
  return INVISIBLE_IN_NAME.test(name);
}

/** T2 - chuẩn hoá họ tên trước khi kiểm và lưu: NFC, gộp mọi khoảng trắng Zs (NBSP, U+3000...) về 1 dấu cách, cắt 2 đầu. */
export function normalizeSignupName(raw: unknown): string {
  return typeof raw === 'string' ? raw.normalize('NFC').replace(/\p{Zs}+/gu, ' ').trim() : '';
}

const LOCAL_PART = /^[a-z0-9._%+-]{1,64}$/;

/** `normalizeEmail` rồi so khớp phần tên với `LOCAL_PART` và phần đuôi với đúng 1 đuôi trong danh sách. */
export function isCompanyEmail(raw: unknown): boolean {
  const email = normalizeEmail(raw);
  if (!email) return false;
  const [local, domain] = email.split('@');
  return LOCAL_PART.test(local) && COMPANY_EMAIL_DOMAINS.includes(domain);
}
