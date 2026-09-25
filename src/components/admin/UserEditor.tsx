'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { Role, UserAccount } from '@/server/repo/types';
import {
  createAccountAction,
  removeUserRoleAction,
  resetPasswordAction,
  setUserRoleAction,
  toggleAccountActiveAction,
} from '@/server/actions';
import { setUserCanViewFinanceAction } from '@/server/actions-user-finance';
import { formatDate } from '@/lib/format';
import { IconClose } from '@/components/icons';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Badge } from '@/components/ui/Badge';

const ROLES: Role[] = ['admin', 'bod', 'data-entry', 'viewer'];

export function UserEditor({ users }: { users: UserAccount[] }) {
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

  const roleLabel = (r: Role) => t(r === 'data-entry' ? 'role.dataEntry' : `role.${r}`);
  const inputCls = 'inp';

  async function add() {
    if (!email.trim() || !name.trim() || password.length < 8) return;
    window.dispatchEvent(new Event('ddc:sync'));
    await createAccountAction(email.trim(), name.trim(), role, password);
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
                <td className="mono">{u.email}</td>
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
                  <button
                    onClick={async () => {
                      window.dispatchEvent(new Event('ddc:sync'));
                      await toggleAccountActiveAction(u.email, !u.isActive);
                      router.refresh();
                    }}
                  >
                    <Badge tone={u.isActive ? 'ok' : 'neutral'}>{u.isActive ? t('admin.active') : t('admin.locked')}</Badge>
                  </button>
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
    </div>
  );
}
