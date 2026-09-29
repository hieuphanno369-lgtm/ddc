import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getAuthStore } from '@/server/auth-store';
import { getResetTokenKind } from '@/server/password-reset';
import { AuthCard } from '@/components/auth/AuthCard';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { AuthHeading, AuthLink, AuthNotice } from '@/components/auth/parts';
import s from '@/components/auth/auth.module.css';

/**
 * S12 - không để trình duyệt gửi token qua header Referer khi trang này link ra ngoài, và không
 * cho công cụ tìm kiếm index (link đặt lại mật khẩu không nên lộ ra kết quả tìm kiếm).
 */
export const metadata: Metadata = {
  referrer: 'no-referrer',
  robots: { index: false },
};

/** P3E (Task 7, D2) - trang đặt lại mật khẩu. KHÔNG gọi `requireUser` (trang public). */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const t = await getTranslations();
  const { token } = await searchParams;
  // S12 - GET chỉ ĐỌC token (không tiêu token) để quyết hiện form hay báo lỗi. Loại link (lời mời hay quên mật khẩu) do
  // server suy từ token, không đọc tham số URL nào khác.
  const kind = await getResetTokenKind(getAuthStore(), token);

  return (
    <AuthCard width={452}>
      {kind ? (
        <ResetPasswordForm token={token ?? ''} kind={kind} />
      ) : (
        <div className={s.stack20}>
          <AuthHeading title={t('authPage.invalidTitle')} />
          <AuthNotice tone="error">{t('authSecurity.resetInvalid')}</AuthNotice>
          <AuthLink href="/quen-mat-khau">{t('authPage.requestNewLink')}</AuthLink>
        </div>
      )}
    </AuthCard>
  );
}
