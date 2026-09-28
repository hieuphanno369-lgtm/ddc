'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { AdminUserRow, Role } from '@/server/repo/types';
import {
  createAccountAction,
  removeUserRoleAction,
  resetPasswordAction,
  setUserRoleAction,
  toggleAccountActiveAction,
} from '@/server/actions';
import { unlockAccountAction } from '@/server/actions-account-lock';
import { setUserCanViewFinanceAction } from '@/server/actions-user-finance';
import { formatDate, formatDateTime } from '@/lib/format';
import { IconClose } from '@/components/icons';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Badge } from '@/components/ui/Badge';

const ROLES: Role[] = ['admin', 'bod', 'data-entry', 'viewer'];

export function UserEditor({ users }: { users: AdminUserRow[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetErr, setResetErr] = useState<string | null>(null);
  const [addErr, setAddErr] = useState<string | null>(null);
  // P3E (Task 6) - modal "Mở khoá + đặt mật khẩu tạm" cho tài khoản đang bị khoá do sai mật khẩu.
  const [unlockTempEmail, setUnlockTempEmail] = useState<string | null>(null);
  const [unlockTempPw, setUnlockTempPw] = useState('');
  const [unlockTempConfirm, setUnlockTempConfirm] = useState('');
  const [unlockTempErr, setUnlockTempErr] = useState<string | null>(null);
  const lockedUsers = users.filter((u) => u.lockedAt !== null);

  const roleLabel = (r: Role) => t(r === 'data-entry' ? 'role.dataEntry' : `role.${r}`);
  const inputCls = 'inp';

  // D1: mật khẩu để trống = tài khoản chỉ đăng nhập Google (passwordHash rỗng); có nhập thì
  // phải đủ 8 ký tự như trước.
  async function add() {
    if (!email.trim() || !name.trim()) return;
    if (password.length > 0 && password.length < 8) {
      setAddErr(t('auth.passwordTooShort'));
      return;
    }
    setAddErr(null);
    window.dispatchEvent(new Event('ddc:sync'));
    const res = await createAccountAction(email.trim(), name.trim(), role, password);
    if (!res.ok) {
      setAddErr(res.error === 'duplicate' ? t('authSecurity.duplicateAccount') : (res.error ?? 'Invalid input'));
      return;
    }
    setEmail('');
    setName('');
    setPassword('');
    router.refresh();
  }

  async function doReset() {
    if (resetPw.length < 8) {
      setResetErr(t('auth.passwordTooShort'));
      return;
    }
    if (resetPw !== resetConfirm) {
      setResetErr(t('auth.mismatch'));
      return;
    }
    window.dispatchEvent(new Event('ddc:sync'));
    await resetPasswordAction(resetEmail!, resetPw);
    setResetEmail(null);
    setResetPw('');
    setResetConfirm('');
    setResetErr(null);
    router.refresh();
  }

  async function doUnlock(targetEmail: string) {
    window.dispatchEvent(new Event('ddc:sync'));
    await unlockAccountAction(targetEmail);
    router.refresh();
  }

  async function doUnlockWithTemp() {
    if (unlockTempPw.length < 8) {
      setUnlockTempErr(t('auth.passwordTooShort'));
      return;
    }
    if (unlockTempPw !== unlockTempConfirm) {
      setUnlockTempErr(t('auth.mismatch'));
      return;
    }
    window.dispatchEvent(new Event('ddc:sync'));
    await unlockAccountAction(unlockTempEmail!, unlockTempPw);
    setUnlockTempEmail(null);
    setUnlockTempPw('');
    setUnlockTempConfirm('');
    setUnlockTempErr(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 field">
          <span className="lb">{t('admin.email')}</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@daidung.com.vn"
            className={`${inputCls} w-full`}
          />
        </div>
        <div className="field">
          <span className="lb">{t('admin.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} w-44`} />
        </div>
        <div className="field">
          <span className="lb">{t('admin.initialPassword')}</span>
          <PasswordInput value={password} onChange={setPassword} className={`${inputCls} w-44`} />
          <p className="hintline">{t('authSecurity.googleOnlyHint')}</p>
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputCls} style={{ width: 'auto' }}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{roleLabel(r)}</option>
          ))}
        </select>
        <button onClick={add} className="btn">
          {t('common.add')}
        </button>
      </div>
      {addErr && <p className="sumbar bad">{addErr}</p>}

      {lockedUsers.length > 0 && (
        <div className="rounded-md border border-danger/30 bg-danger/5 p-3 space-y-2">
          <div className="text-callout font-semibold">{t('authSecurity.lockedList', { n: lockedUsers.length })}</div>
          {lockedUsers.map((u) => (
            <div key={u.email} className="flex flex-wrap items-center gap-2 text-footnote">
              <span className="mono">{u.email}</span>
              <span className="text-label3">{formatDateTime(u.lockedAt, locale)}</span>
              <button
                onClick={() => doUnlock(u.email)}
                className="btn ghost"
                style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }}
              >
                {t('authSecurity.unlock')}
              </button>
              <button
                onClick={() => setUnlockTempEmail(u.email)}
                className="btn ghost"
                style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }}
              >
                {t('authSecurity.unlockWithTemp')}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('admin.email')}</th>
              <th>{t('admin.name')}</th>
              <th>{t('admin.role')}</th>
              <th>{t('admin.canViewFinance')}</th>
              <th>{t('admin.status')}</th>
              <th>{t('admin.lastLogin')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email}>
                <td className="mono">
                  {u.email}
                  {!u.hasPassword && (
                    <Badge tone="info" className="ml-1">
                      {t('authSecurity.googleOnly')}
                    </Badge>
                  )}
                </td>
                <td>{u.name}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={async (e) => {
                      window.dispatchEvent(new Event('ddc:sync'));
                      await setUserRoleAction(u.email, e.target.value as Role);
                      router.refresh();
                    }}
                    className={inputCls}
                    style={{ width: 'auto' }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{roleLabel(r)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {u.role === 'admin' ? (
                    <Badge tone="ok">{t('admin.canViewFinanceAlways')}</Badge>
                  ) : u.role === 'data-entry' ? (
                    // T-1 (danh-gia-bao-mat.md): data-entry luôn canViewFinance=true ở tầng server
                    // (resolveAccess + setUserCanViewFinanceAction từ chối tắt) - không cho bấm tắt
                    // ở đây để tránh "cảm giác an toàn giả".
                    <Badge tone="ok">{t('admin.canViewFinanceOn')}</Badge>
                  ) : (
                    <button
                      onClick={async () => {
                        window.dispatchEvent(new Event('ddc:sync'));
                        await setUserCanViewFinanceAction(u.email, !u.canViewFinance);
                        router.refresh();
                      }}
                    >
                      <Badge tone={u.canViewFinance ? 'ok' : 'neutral'}>
                        {u.canViewFinance ? t('admin.canViewFinanceOn') : t('admin.canViewFinanceOff')}
                      </Badge>
                    </button>
                  )}
                </td>
                <td>
                  {u.lockedAt !== null ? (
                    // P3E (Task 6) - khoá do sai mật khẩu (khác isActive): không bấm được ở đây,
                    // mở khoá qua khối "Tài khoản đang bị khoá" phía trên.
                    <Badge tone="danger">{t('authSecurity.lockedBadge')}</Badge>
                  ) : (
                    <button
                      onClick={async () => {
                        window.dispatchEvent(new Event('ddc:sync'));
                        await toggleAccountActiveAction(u.email, !u.isActive);
                        router.refresh();
                      }}
                    >
                      <Badge tone={u.isActive ? 'ok' : 'neutral'}>{u.isActive ? t('admin.active') : t('admin.locked')}</Badge>
                    </button>
                  )}
                </td>
                <td>{u.lastLoginAt ? formatDate(u.lastLoginAt, locale) : '-'}</td>
                <td className="num">
                  <button onClick={() => setResetEmail(u.email)} className="btn ghost" style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)' }}>
                    {t('admin.resetPassword')}
                  </button>
                  <button
                    onClick={async () => {
                      window.dispatchEvent(new Event('ddc:sync'));
                      await removeUserRoleAction(u.email);
                      router.refresh();
                    }}
                    className="btn ghost"
                    style={{ padding: '4px 10px', fontSize: 'var(--t-caption1)', color: 'var(--danger)' }}
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetEmail && (
        <div className="modal-scrim" onClick={() => setResetEmail(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-callout font-semibold">
                {t('admin.resetPassword')} - {resetEmail}
              </h2>
              <button onClick={() => setResetEmail(null)} className="rounded-sm p-2 text-label3 transition-colors duration-fast hover:bg-fill hover:text-label">
                <IconClose size={18} />
              </button>
            </div>
            <div className="space-y-3.5">
              <div className="field">
                <span className="lb">{t('auth.newPassword')}</span>
                <PasswordInput value={resetPw} onChange={setResetPw} className={`${inputCls} w-full`} showStrength />
              </div>
              <div className="field">
                <span className="lb">{t('auth.confirmPassword')}</span>
                <PasswordInput value={resetConfirm} onChange={setResetConfirm} className={`${inputCls} w-full`} />
              </div>
              {resetErr && <p className="sumbar bad">{resetErr}</p>}
              <button onClick={doReset} className="btn w-full justify-center">
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {unlockTempEmail && (
        <div className="modal-scrim" onClick={() => setUnlockTempEmail(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-callout font-semibold">
                {t('authSecurity.unlockWithTemp')} - {unlockTempEmail}
              </h2>
              <button onClick={() => setUnlockTempEmail(null)} className="rounded-sm p-2 text-label3 transition-colors duration-fast hover:bg-fill hover:text-label">
                <IconClose size={18} />
              </button>
            </div>
            <div className="space-y-3.5">
              <div className="field">
                <span className="lb">{t('auth.newPassword')}</span>
                <PasswordInput value={unlockTempPw} onChange={setUnlockTempPw} className={`${inputCls} w-full`} showStrength />
              </div>
              <div className="field">
                <span className="lb">{t('auth.confirmPassword')}</span>
                <PasswordInput value={unlockTempConfirm} onChange={setUnlockTempConfirm} className={`${inputCls} w-full`} />
              </div>
              {unlockTempErr && <p className="sumbar bad">{unlockTempErr}</p>}
              <button onClick={doUnlockWithTemp} className="btn w-full justify-center">
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
