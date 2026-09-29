'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { IconMail } from '@/components/icons';
import { requestPasswordResetAction } from '@/server/actions-password-reset';
import s from './auth.module.css';
import {
  AuthBackLink,
  AuthField,
  AuthGhostButton,
  AuthHeading,
  AuthIconTile,
  AuthInput,
  AuthNotice,
  AuthPrimaryButton,
} from './parts';

/** P3E (Task 7, D2) - form xin link đặt lại mật khẩu; luôn hiện "đã gửi" (S3, không lộ email tồn tại). */
export function ForgotPasswordForm() {
  const t = useTranslations();
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [smtpMissing, setSmtpMissing] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await requestPasswordResetAction(email, locale);
    if (res.status === 'smtp_missing') {
      setSmtpMissing(true);
      setBusy(false);
      return;
    }
    // S3 - kể cả email lạ cũng hiện "đã gửi" giống hệt, không lộ email nào tồn tại.
    setSent(true);
  }

  if (sent) {
    return (
      <div className={s.stack20}>
        <AuthIconTile>
          <IconMail size={26} />
        </AuthIconTile>
        <div className={s.heading}>
          <h1 className={s.title}>{t('authPage.sentTitle')}</h1>
          <p className={s.intro}>{t('authPage.sentBody')}</p>
        </div>
        <AuthGhostButton href="/login">{t('authSecurity.backToLogin')}</AuthGhostButton>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={s.form}>
      <AuthBackLink href="/login">{t('authSecurity.backToLogin')}</AuthBackLink>
      <AuthHeading
        eyebrow={t('authPage.recoveryEyebrow')}
        title={t('authPage.forgotHeading')}
        intro={t('authPage.forgotBody')}
      />
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
      {smtpMissing && <AuthNotice tone="error">{t('authSecurity.smtpMissing')}</AuthNotice>}
      <AuthPrimaryButton busy={busy} busyLabel={t('authPage.sending')}>
        {t('authPage.sendResetLink')}
      </AuthPrimaryButton>
    </form>
  );
}
