/**
 * P3E (D1) - quyết ai được vào bằng Google, tách khỏi callback next-auth để test độc lập
 * (không cần dựng session/DB thật). S9: chỉ vào khi email đã xác minh, có trong danh sách admin
 * thêm (tài khoản không null), đang hoạt động, chưa bị khoá.
 */
export type GoogleDecision = 'allow' | 'unverified' | 'not_found' | 'inactive' | 'locked';

export interface GoogleProfileLite {
  email?: string | null;
  email_verified?: boolean | null;
}

export interface GoogleAccountLite {
  isActive: boolean;
  lockedAt?: string | null;
}

/** `account` phải được tìm bằng email đã hạ chữ thường TRƯỚC khi gọi hàm này (hàm không tự lower). */
export function googleAccessDecision(
  profile: GoogleProfileLite,
  account: GoogleAccountLite | null,
): GoogleDecision {
  if (profile.email_verified !== true) return 'unverified';
  if (!account) return 'not_found';
  if (!account.isActive) return 'inactive';
  if (account.lockedAt) return 'locked';
  return 'allow';
}
