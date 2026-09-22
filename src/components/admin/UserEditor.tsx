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
import { formatDate } from '@/lib/format';
import { IconClose } from '@/components/icons';
import { PasswordInput } from '@/components/ui/PasswordInput';

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
  const inputCls =
    'h-9 rounded-lg border border-slate-200 px-2.5 text-sm text-navy-800 focus:border-accent focus:outline-none';

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
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">{t('admin.email')}</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@daidung.com.vn"
            className={`${inputCls} w-full`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">{t('admin.name')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} w-44`} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">{t('admin.initialPassword')}</label>
          <PasswordInput value={password} onChange={setPassword} className={`${inputCls} w-44`} />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputCls}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{roleLabel(r)}</option>
          ))}
        </select>
        <button onClick={add} className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90">
          {t('common.add')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400">
              <th className="py-1.5 font-medium">{t('admin.email')}</th>
              <th className="py-1.5 font-medium">{t('admin.name')}</th>
              <th className="py-1.5 font-medium">{t('admin.role')}</th>
              <th className="py-1.5 font-medium">{t('admin.status')}</th>
              <th className="py-1.5 font-medium">{t('admin.lastLogin')}</th>
              <th className="py-1.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.email}>
                <td className="py-2 text-navy-800">{u.email}</td>
                <td className="py-2 text-slate-600">{u.name}</td>
                <td className="py-2">
                  <select
                    value={u.role}
                    onChange={async (e) => {
                      window.dispatchEvent(new Event('ddc:sync'));
                      await setUserRoleAction(u.email, e.target.value as Role);
                      router.refresh();
                    }}
                    className={inputCls}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{roleLabel(r)}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2">
                  <button
                    onClick={async () => {
                      window.dispatchEvent(new Event('ddc:sync'));
                      await toggleAccountActiveAction(u.email, !u.isActive);
                      router.refresh();
                    }}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      u.isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {u.isActive ? t('admin.active') : t('admin.locked')}
                  </button>
                </td>
                <td className="py-2 text-xs text-slate-500">{u.lastLoginAt ? formatDate(u.lastLoginAt, locale) : '-'}</td>
                <td className="whitespace-nowrap py-2 text-right">
                  <button onClick={() => setResetEmail(u.email)} className="rounded-lg px-2 py-1 text-xs text-navy-800 hover:bg-slate-50">
                    {t('admin.resetPassword')}
                  </button>
                  <button
                    onClick={async () => {
                      window.dispatchEvent(new Event('ddc:sync'));
                      await removeUserRoleAction(u.email);
                      router.refresh();
                    }}
                    className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-950/60 p-4" onClick={() => setResetEmail(null)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-navy-900 dark:text-slate-100">
                {t('admin.resetPassword')} - {resetEmail}
              </h2>
              <button onClick={() => setResetEmail(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                <IconClose size={18} />
              </button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">{t('auth.newPassword')}</label>
                <PasswordInput value={resetPw} onChange={setResetPw} className={`${inputCls} w-full`} showStrength />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">{t('auth.confirmPassword')}</label>
                <PasswordInput value={resetConfirm} onChange={setResetConfirm} className={`${inputCls} w-full`} />
              </div>
              {resetErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{resetErr}</p>}
              <button onClick={doReset} className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90">
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
