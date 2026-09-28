import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getAuthSmtpConfig } from '@/server/auth-mail';
import { ForgotPasswordForm } from '@/components/layout/ForgotPasswordForm';

/**
 * P3E (Task 7, D2) - trang quên mật khẩu. KHÔNG gọi `requireUser` (trang public, xem `middleware.ts`
 * `PUBLIC_PATHS`); khung copy `app/[locale]/login/page.tsx`.
 */
export default async function ForgotPasswordPage() {
  const t = await getTranslations();
  const smtpReady = Boolean(process.env.NEXTAUTH_URL) && (await getAuthSmtpConfig()) !== null;

  return (
    <div className="authwrap">
      <div className="authcard">
        <div className="brandbox">
          <div className="appicon is-brand overflow-hidden" style={{ width: 56, height: 56, flex: '0 0 56px' }}>
            <Image src="/logo.png" alt="DDC" width={56} height={56} className="h-full w-full object-cover" />
          </div>
          <h1>{t('authSecurity.forgotTitle')}</h1>
          <p>{t('authSecurity.forgotIntro')}</p>
        </div>
        {smtpReady ? (
          <ForgotPasswordForm />
        ) : (
          <div className="flex flex-col gap-3.5">
            <p className="sumbar bad">{t('authSecurity.smtpMissing')}</p>
            <Link href="/login" className="hintline" style={{ textAlign: 'center' }}>
              {t('authSecurity.backToLogin')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
