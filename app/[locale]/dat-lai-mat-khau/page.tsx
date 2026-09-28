import Image from 'next/image';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getAuthStore } from '@/server/auth-store';
import { isResetTokenUsable } from '@/server/password-reset';
import { ResetPasswordForm } from '@/components/layout/ResetPasswordForm';

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
  // S12 - GET chỉ ĐỌC token (isResetTokenUsable không tiêu token) để quyết hiện form hay báo lỗi.
  const usable = await isResetTokenUsable(getAuthStore(), token);

  return (
    <div className="authwrap">
      <div className="authcard">
        <div className="brandbox">
          <div className="appicon is-brand overflow-hidden" style={{ width: 56, height: 56, flex: '0 0 56px' }}>
            <Image src="/logo.png" alt="DDC" width={56} height={56} className="h-full w-full object-cover" />
          </div>
          <h1>{t('authSecurity.resetTitle')}</h1>
        </div>
        {usable ? (
          <ResetPasswordForm token={token ?? ''} />
        ) : (
          <div className="flex flex-col gap-3.5">
            <p className="sumbar bad">{t('authSecurity.resetInvalid')}</p>
            <Link href="/quen-mat-khau" className="hintline" style={{ textAlign: 'center' }}>
              {t('authSecurity.forgotLink')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
