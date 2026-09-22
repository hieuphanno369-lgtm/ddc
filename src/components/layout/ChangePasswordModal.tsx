'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { changePasswordAction } from '@/server/actions';
import { IconClose } from '@/components/icons';
import { PasswordInput } from '@/components/ui/PasswordInput';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-navy-900 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none';

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
      // đổi xong → đăng xuất, bắt đăng nhập lại bằng mật khẩu mới
      await signOut({ redirect: true, callbackUrl: '/' });
    } else if (res.error === 'current') {
      setMsg(t('auth.currentWrong'));
    } else {
      setMsg(t('auth.passwordTooShort'));
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-950/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-navy-900 dark:text-slate-100">{t('auth.changePassword')}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{t('auth.passwordTooShort')}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label={t('common.close')}
          >
            <IconClose size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">{t('auth.currentPassword')}</label>
            <PasswordInput value={current} onChange={setCurrent} className={inputCls} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">{t('auth.newPassword')}</label>
            <PasswordInput value={next} onChange={setNext} className={inputCls} required showStrength />
            <p className="mt-1 text-[11px] text-slate-400">{t('auth.passwordHint')}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">{t('auth.confirmPassword')}</label>
            <PasswordInput value={confirm} onChange={setConfirm} className={inputCls} required />
          </div>
          {msg && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{msg}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {t('common.save')}
          </button>
        </form>
      </div>
    </div>
  );
}
