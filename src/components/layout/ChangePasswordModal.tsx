'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { changePasswordAction } from '@/server/actions';
import { IconClose } from '@/components/icons';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { clearDraftsOnLogout } from '@/lib/drafts';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputCls = 'inp';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      setMsg(t('auth.passwordTooShort'));
      return;
    }
    if (next !== confirm) {
      setMsg(t('auth.mismatch'));
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await changePasswordAction(current, next);
    setBusy(false);
    if (res.ok) {
      // đổi xong → đăng xuất, bắt đăng nhập lại bằng mật khẩu mới (F6: xoá nháp như logout thường).
      clearDraftsOnLogout(window.localStorage);
      await signOut({ redirect: true, callbackUrl: '/' });
    } else if (res.error === 'current') {
      setMsg(t('auth.currentWrong'));
    } else {
      setMsg(t('auth.passwordTooShort'));
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-callout font-semibold">{t('auth.changePassword')}</h2>
            <p className="hintline">{t('auth.passwordTooShort')}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm p-2 text-label3 transition-colors duration-fast hover:bg-fill hover:text-label"
            aria-label={t('common.close')}
          >
            <IconClose size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          <div className="field">
            <span className="lb">{t('auth.currentPassword')}</span>
            <PasswordInput value={current} onChange={setCurrent} className={inputCls} required />
          </div>
          <div className="field">
            <span className="lb">{t('auth.newPassword')}</span>
            <PasswordInput value={next} onChange={setNext} className={inputCls} required showStrength />
            <p className="hintline">{t('auth.passwordHint')}</p>
          </div>
          <div className="field">
            <span className="lb">{t('auth.confirmPassword')}</span>
            <PasswordInput value={confirm} onChange={setConfirm} className={inputCls} required />
          </div>
          {msg && <p className="sumbar bad">{msg}</p>}
          <button
            type="submit"
            disabled={busy}
            className="btn w-full justify-center"
          >
            {t('common.save')}
          </button>
        </form>
      </div>
    </div>
  );
}
