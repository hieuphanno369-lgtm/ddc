'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { submitPasswordResetAction } from '@/server/actions-password-reset';

type Done = { locked: boolean } | null;

/**
 * P3E (Task 7, D2, S12) - `token` chỉ truyền vào action ('use server'), KHÔNG đưa vào URL nào
 * khác, KHÔNG lưu localStorage/sessionStorage.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Done>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await submitPasswordResetAction(token, password, confirm);
    if (!res.ok) {
      setErr(
        res.error === 'too_short'
          ? t('auth.passwordTooShort')
          : res.error === 'mismatch'
            ? t('auth.mismatch')
            : t('authSecurity.resetInvalid'),
      );
      setBusy(false);
      return;
    }
    setDone({ locked: res.locked });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3.5">
        <p className="sumbar good">{done.locked ? t('authSecurity.resetDoneLocked') : t('authSecurity.resetDone')}</p>
        <Link href="/login" className="hintline" style={{ textAlign: 'center' }}>
          {t('authSecurity.backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="field">
        <span className="lb">{t('auth.newPassword')}</span>
        <PasswordInput value={password} onChange={setPassword} className="inp" showStrength required />
      </div>
      <div className="field">
        <span className="lb">{t('auth.confirmPassword')}</span>
        <PasswordInput value={confirm} onChange={setConfirm} className="inp" required />
      </div>
      {err && <p className="sumbar bad">{err}</p>}
      <button type="submit" disabled={busy} className="btn w-full justify-center">
        {t('authSecurity.resetSubmit')}
      </button>
    </form>
  );
}
