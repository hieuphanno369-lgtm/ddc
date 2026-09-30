'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { submitPasswordResetAction } from '@/server/actions-password-reset';
import type { ResetTokenKind } from '@/lib/login-policy';
import s from './auth.module.css';
import {
  AuthField,
  AuthGhostButton,
  AuthHeading,
  AuthNotice,
  AuthPasswordInput,
  AuthPrimaryButton,
} from './parts';
import { PasswordStrength } from './PasswordStrength';

type Done = { locked: boolean } | null;

/**
 * P3E (Task 7, D2, S12) - `token` chỉ truyền vào action ('use server'), KHÔNG đưa vào URL nào
 * khác, KHÔNG lưu localStorage/sessionStorage. `kind` do server suy từ token (trang cha), chỉ đổi chữ hiển thị.
 */
export function ResetPasswordForm({ token, kind = 'reset' }: { token: string; kind?: ResetTokenKind }) {
  const t = useTranslations();
  const invite = kind === 'invite';
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
      <div className={s.stack20}>
        <AuthNotice tone="success">
          {done.locked
            ? t(invite ? 'signup.inviteDoneLocked' : 'authSecurity.resetDoneLocked')
            : t(invite ? 'signup.inviteDone' : 'authSecurity.resetDone')}
        </AuthNotice>
        <AuthGhostButton href="/login">{t('authSecurity.backToLogin')}</AuthGhostButton>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={s.form}>
      <AuthHeading
        eyebrow={t(invite ? 'signup.inviteEyebrow' : 'authPage.recoveryEyebrow')}
        title={t(invite ? 'signup.inviteTitle' : 'authSecurity.resetTitle')}
        intro={t(invite ? 'signup.inviteIntro' : 'authPage.resetIntro')}
      />
      <div className={s.field}>
        <AuthField id="auth-new-password" label={t('auth.newPassword')}>
          <AuthPasswordInput
            id="auth-new-password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
          />
        </AuthField>
        <PasswordStrength value={password} />
      </div>
      <AuthField id="auth-confirm-password" label={t('auth.confirmPassword')}>
        <AuthPasswordInput
          id="auth-confirm-password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
        />
      </AuthField>
      {err && <AuthNotice tone="error">{err}</AuthNotice>}
      <AuthPrimaryButton busy={busy} busyLabel={t('authPage.saving')}>
        {t(invite ? 'signup.inviteSubmit' : 'authSecurity.resetSubmit')}
      </AuthPrimaryButton>
    </form>
  );
}
