'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { requestPasswordResetAction } from '@/server/actions-password-reset';

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
    return <p className="sumbar good">{t('authSecurity.forgotSent')}</p>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="field">
          <span className="lb">{t('auth.email')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@daidung.com.vn"
            required
            className="inp"
          />
        </div>
        {smtpMissing && <p className="sumbar bad">{t('authSecurity.smtpMissing')}</p>}
        <button type="submit" disabled={busy} className="btn w-full justify-center">
          {t('authSecurity.forgotSubmit')}
        </button>
      </form>
      <Link href="/login" className="hintline" style={{ textAlign: 'center' }}>
        {t('authSecurity.backToLogin')}
      </Link>
    </div>
  );
}
