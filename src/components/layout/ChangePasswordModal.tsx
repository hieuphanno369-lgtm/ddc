'use client';

import { useState } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { changePasswordAction } from '@/server/actions';
import { IconClose } from '@/components/icons';
import { PasswordInput } from '@/components/ui/PasswordInput';

/**
 * S-2 (bao-mat.md vòng 4, chủ dự án chốt 2026-09-28, thay quyết định Q2=b cũ) - tự đổi mật khẩu
 * KHÔNG còn đăng xuất phiên hiện tại (trước đây `signOut()` ngay sau khi đổi xong). `useSession()`
 * cần `SessionProvider` trong cây React - repo này chưa có 1 cái ở layout gốc (chỉ dùng
 * `getServerSession`/session server-side), nên bọc RIÊNG quanh modal này (không đổi kiến trúc đăng
 * nhập toàn app) chỉ để lấy `update()`.
 */
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  return (
    <SessionProvider>
      <ChangePasswordModalInner onClose={onClose} />
    </SessionProvider>
  );
}

function ChangePasswordModalInner({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const { update } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
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
    setDone(false);
    const res = await changePasswordAction(current, next);
    setBusy(false);
    if (res.ok) {
      // S-2 - mật khẩu đã đổi bump `passwordChangedAt` (vô hiệu các phiên KHÁC trong tối đa 5 phút
      // - ACCESS_RECHECK_INTERVAL_MS); CHÍNH phiên này làm mới `token.pwdAt` NGAY qua `update()` để
      // không bị vô hiệu nhầm, KHÔNG cần đăng nhập lại.
      await update();
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
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
          {done && <p className="sumbar good">{t('authSecurity.changePasswordDone')}</p>}
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
