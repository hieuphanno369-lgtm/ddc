'use client';

import { useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { usePressable } from '@/components/ui/motion';
import s from './auth.module.css';
import { cx } from './cx';
import {
  AuthDivider,
  AuthField,
  AuthHeading,
  AuthInput,
  AuthLink,
  AuthNotice,
  AuthPasswordInput,
  AuthPrimaryButton,
  GoogleButton,
} from './parts';

export function LoginForm({
  googleEnabled,
  initialError,
}: {
  googleEnabled: boolean;
  initialError?: 'googleDenied' | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    initialError === 'googleDenied' ? t('authSecurity.googleDenied') : null,
  );
  // CS-3: nút đăng nhập chính là "nút quan trọng" được gắn usePressable (co lại khi bấm rồi bật về bằng spring, engine motion.ts).
  const submitRef = useRef<HTMLButtonElement>(null);
  usePressable(submitRef);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn('credentials', { redirect: false, email, password });
    if (res?.error) {
      // Task 6 (D3) - `authorize` ném nguyên văn 'locked'/'ip_limited' qua `res.error`; các lỗi
      // khác (sai email/mật khẩu, hoặc lỗi hạ tầng đã bị `authorize` nuốt thành `null`) đều hiện
      // chung 1 thông báo (không lộ chi tiết).
      setError(
        res.error === 'locked'
          ? t('authSecurity.locked')
          : res.error === 'ip_limited'
            ? t('authSecurity.ipLimited')
            : t('auth.invalidCredentials'),
      );
      setBusy(false);
    } else {
      router.replace('/overview');
    }
  }

  return (
    <form onSubmit={submit} className={s.form}>
      <div className={cx(s.up, s.u1)}>
        <AuthHeading
          eyebrow={t('authPage.loginEyebrow')}
          title={t('authPage.loginTitle')}
          intro={t('authPage.loginIntro')}
          hideOnMobile
        />
      </div>

      {googleEnabled && (
        <>
          <div className={cx(s.up, s.u2)}>
            <GoogleButton
              busy={busy}
              onClick={() => {
                setBusy(true);
                signIn('google', { callbackUrl: `/${locale}` });
              }}
            />
          </div>
          <div className={cx(s.up, s.u3)}>
            <AuthDivider label={t('authPage.orEmail')} />
          </div>
        </>
      )}

      <div className={cx(s.stack14, s.up, s.u4)}>
        <AuthField id="auth-email" label={t('auth.email')}>
          <AuthInput
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('authPage.emailPlaceholder')}
            required
          />
        </AuthField>
        <AuthField
          id="auth-password"
          label={t('auth.password')}
          aside={<AuthLink href="/quen-mat-khau">{t('authSecurity.forgotLink')}</AuthLink>}
        >
          <AuthPasswordInput
            id="auth-password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder={t('authPage.passwordPlaceholder')}
            required
          />
        </AuthField>
        {error && <AuthNotice tone="error">{error}</AuthNotice>}
      </div>

      <div className={cx(s.up, s.u5)}>
        <AuthPrimaryButton ref={submitRef} busy={busy} busyLabel={t('authPage.signingIn')} arrow>
          {t('auth.signIn')}
        </AuthPrimaryButton>
      </div>

      <p className={cx(s.linkRow, s.up, s.u6)}>
        {t('authPage.noAccount')} <AuthLink href="/dang-ky">{t('authPage.createAccount')}</AuthLink>
      </p>
    </form>
  );
}
