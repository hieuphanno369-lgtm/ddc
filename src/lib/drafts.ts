/**
 * F6 (P3A, Task 10): bản nháp gắn theo người dùng - `draftOwnerTag` băm email thành 1 chuỗi ngắn
 * dùng làm 1 phần khoá localStorage, để 2 người dùng chung máy không thấy nháp của nhau, và để
 * xoá sạch bản nháp khi đăng xuất (`clearAllDrafts`).
 */

/** FNV-1a 32-bit của `email.trim().toLowerCase()` → 8 ký tự hex thường. */
export function draftOwnerTag(email: string): string {
  const s = email.trim().toLowerCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export type KeyStore = { readonly length: number; key(i: number): string | null; removeItem(k: string): void };

function keysOf(s: KeyStore): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k) out.push(k);
  }
  return out;
}

/** Đăng xuất: xoá MỌI bản nháp (mọi phiên bản, mọi chủ) - trả số key đã xoá. */
export function clearAllDrafts(s: KeyStore): number {
  const toRemove = keysOf(s).filter((k) => k.startsWith('ddc_draft_') || k.startsWith('ddc_pform_'));
  for (const k of toRemove) s.removeItem(k);
  return toRemove.length;
}

/**
 * Lúc mount form: xoá bản nháp v1/v2 (không còn đọc được nữa) và bản nháp v3/pform của
 * NGƯỜI KHÁC (khác `ownerTag`) - không bao giờ áp nhầm nháp của người trước dùng chung máy.
 */
export function purgeForeignDrafts(s: KeyStore, ownerTag: string): number {
  const v3Prefix = `ddc_draft_v3_${ownerTag}_`;
  const pformPrefix = `ddc_pform_v1_${ownerTag}_`;
  const toRemove = keysOf(s).filter((k) => {
    if (k.startsWith('ddc_draft_v2_')) return true;
    if (/^ddc_draft_\d+_/.test(k)) return true; // v1: 'ddc_draft_<projectId>_<month>'
    if (k.startsWith('ddc_draft_v3_')) return !k.startsWith(v3Prefix);
    if (k.startsWith('ddc_pform_v1_')) return !k.startsWith(pformPrefix);
    return false;
  });
  for (const k of toRemove) s.removeItem(k);
  return toRemove.length;
}

/**
 * F6: xoá mọi bản nháp trước khi đăng xuất (SettingsMenu) - người dùng kế tiếp dùng chung máy
 * không được thấy nháp của người này. localStorage có thể bị chặn (chế độ riêng tư) nên bọc
 * try/catch - không bao giờ chặn luồng đăng xuất vì lỗi localStorage.
 * S-2 (bao-mat.md vòng 4) - `ChangePasswordModal` KHÔNG còn gọi hàm này: tự đổi mật khẩu không còn
 * đăng xuất phiên hiện tại nên không có "người dùng kế tiếp" ở đây.
 */
export function clearDraftsOnLogout(storage: KeyStore): void {
  try {
    clearAllDrafts(storage);
  } catch {
    // bỏ qua.
  }
}
