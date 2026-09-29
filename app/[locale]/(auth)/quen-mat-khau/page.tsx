import { getTranslations } from 'next-intl/server';
import { getAuthSmtpConfig } from '@/server/auth-mail';
import { AuthCard } from '@/components/auth/AuthCard';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { AuthBackLink, AuthHeading, AuthNotice } from '@/components/auth/parts';
import s from '@/components/auth/auth.module.css';

/**
 * P3E (Task 7, D2) - trang quên mật khẩu. KHÔNG gọi `requireUser` (trang public, xem `middleware.ts`
 * `PUBLIC_PATHS`); khung copy trang đăng nhập.
 */
export default async function ForgotPasswordPage() {
  const t = await getTranslations();
  const smtpReady = Boolean(process.env.NEXTAUTH_URL) && (await getAuthSmtpConfig()) !== null;

  return (
    <AuthCard width={452}>
      {smtpReady ? (
        <ForgotPasswordForm />
      ) : (
        <div className={s.stack20}>
          <AuthHeading eyebrow={t('authPage.recoveryEyebrow')} title={t('authPage.forgotHeading')} />
          <AuthNotice tone="error">{t('authSecurity.smtpMissing')}</AuthNotice>
          <AuthBackLink href="/login">{t('authSecurity.backToLogin')}</AuthBackLink>
        </div>
      )}
    </AuthCard>
  );
}
