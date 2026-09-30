import type { Role } from '@/server/repo/types';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      role?: Role;
      canViewFinance?: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role;
    canViewFinance?: boolean;
    /** T-5 (danh-gia-bao-mat.md): mốc lần cuối đọc lại quyền từ DB (Date.now(), ms). */
    accessCheckedAt?: number;
    /** T-5: true = tài khoản bị khoá/không còn trong DB - callback session() vô hiệu session. */
    invalid?: boolean;
    /** P3E (Task 7, S8) - Date.parse(passwordChangedAt) lúc đăng nhập (ms); 0 nếu chưa từng đổi. */
    pwdAt?: number;
  }
}
