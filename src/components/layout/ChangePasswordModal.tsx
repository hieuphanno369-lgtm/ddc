'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { changePasswordAction } from '@/server/actions';
import { IconClose } from '@/components/icons';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { clearDraftsOnLogout } from '@/lib/drafts';

/**
 * S-2 (chủ dự án chốt 2026-09-28, thay quyết định Q2=b cũ) - tự đổi mật khẩu
 * KHÔNG còn đăng xuất phiên hiện tại (trước đây `signOut()` ngay sau khi đổi xong).
 * R2-1 (bao-mat.md vòng 2, CAO) - bỏ `useSession()`/`update()` và `SessionProvider` bọc riêng: phiên
 * hiện tại giờ được server tự cấp lại cookie mới ngay trong `changePasswordAction`
 * (`reissueSessionCookie` ở `src/lib/auth.ts`), không còn cần client tự gọi `update()` (đường đó
 * cho phép BẤT KỲ ai giữ cookie phiên "hồi sinh" phiên đã bị vô hiệu qua `POST /api/auth/session`).
 * Tester (vòng sau sửa bảo mật 2, e2e/25) - `SettingsMenu.tsx` render component này làm CON của
 * `<aside class="side">`, mà `.side` có `backdrop-filter` (tạo containing block MỚI cho hậu duệ
 * `position: fixed` theo đặc tả CSS Filter Effects) nên `.modal-scrim` (`position: fixed; inset: 0`)
 * bị "nhốt" trong khung ~236px của sidebar thay vì phủ toàn viewport. Dùng `createPortal` ra thẳng
 * `document.body` để thoát khỏi containing block đó - modal không còn phụ thuộc trạng thái mở/đóng
 * (`.is-open`) hay vị trí của `.side` nữa.
 */
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
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
      // R2-1 - server đã tự cấp lại cookie phiên mới cho CHÍNH phiên này (reissueSessionCookie),
      // không cần làm gì thêm ở client, KHÔNG cần đăng nhập lại.
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } else if (res.error === 'current') {
      setMsg(t('auth.currentWrong'));
    } else if (res.error === 'locked') {
      // R3-2 (bao-mat.md vòng 3) - đủ 5 lần sai, server đã khoá tài khoản VÀ vô hiệu ngay cookie
      // phiên này (invalidateCurrentSessionCookie). Tái dùng thông báo khoá sẵn có (không thêm key
      // i18n mới); tải lại trang để middleware (đã thấy cookie invalid) tự đẩy về /login.
      setMsg(t('authSecurity.locked'));
      // F6 - phiên đã bị đá: xoá bản nháp như khi đăng xuất thường.
      clearDraftsOnLogout(window.localStorage);
      window.setTimeout(() => window.location.reload(), 1500);
    } else if (res.error === 'ip_limited') {
      setMsg(t('authSecurity.ipLimited'));
    } else {
      setMsg(t('auth.passwordTooShort'));
    }
  }

  return createPortal(
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
    </div>,
    document.body,
  );
}
