import { redirect } from 'next/navigation';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { getTranslations } from 'next-intl/server';
import { getAuthSmtpConfig } from '@/server/auth-mail';
import { getSignupStore } from '@/server/signup-store';
import { AuthCard } from '@/components/auth/AuthCard';
import { SignupForm } from '@/components/auth/SignupForm';
import { AuthBackLink, AuthHeading, AuthNotice } from '@/components/auth/parts';
import s from '@/components/auth/auth.module.css';

/** P3F-3 - trang đăng ký tài khoản chờ admin bật. Công khai (xem `middleware.ts` `PUBLIC_PATHS`), không gọi `requireUser`. */
export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}${homeForRole(user.role)}`);

  // S1: không gửi được link đặt mật khẩu thì tắt form đăng ký (khuôn trang Quên mật khẩu).
  const smtpReady = Boolean(process.env.NEXTAUTH_URL) && (await getAuthSmtpConfig()) !== null;
  if (!smtpReady) {
    const t = await getTranslations();
    return (
      <AuthCard width={480}>
        <div className={s.stack20}>
          <AuthHeading eyebrow={t('signup.eyebrow')} title={t('signup.title')} />
          <AuthNotice tone="error">{t('signup.smtpMissing')}</AuthNotice>
          <AuthBackLink href="/login">{t('authSecurity.backToLogin')}</AuthBackLink>
        </div>
      </AuthCard>
    );
  }

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const departments = await getSignupStore().listActiveDepartments();

  return (
    <AuthCard width={480}>
      <SignupForm departments={departments} googleEnabled={googleEnabled} />
    </AuthCard>
  );
}
