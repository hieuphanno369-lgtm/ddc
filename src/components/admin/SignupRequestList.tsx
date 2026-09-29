'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/format';
import type { SignupRequestRow } from '@/server/repo/signup-types';
import type { Role } from '@/server/repo/types';
import { approveSignupAction, rejectSignupAction } from '@/server/actions-signup-admin';

const ROLES: Role[] = ['admin', 'bod', 'data-entry', 'viewer'];

type Msg = { tone: 'good' | 'bad'; text: string } | null;

/** P3F-3 - bảng đăng ký đang chờ trong Quản trị: chọn vai trò rồi Bật tài khoản, hoặc Từ chối. Khuôn bảng `FactoryEditor.tsx`. */
export function SignupRequestList({ requests }: { requests: SignupRequestRow[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  // Mặc định vai trò ít quyền nhất (viewer); admin chỉnh trước khi bật.
  const [roles, setRoles] = useState<Record<number, Role>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const roleLabel = (r: Role) => t(r === 'data-entry' ? 'role.dataEntry' : `role.${r}`);

  async function approve(r: SignupRequestRow) {
    setMsg(null);
    setBusyId(r.id);
    window.dispatchEvent(new Event('ddc:sync'));
    const res = await approveSignupAction(r.id, roles[r.id] ?? 'viewer');
    setBusyId(null);
    if (res.ok) {
      setMsg({ tone: 'good', text: t(res.mailed ? 'signup.approvedMailed' : 'signup.approvedNoMail', { email: r.email }) });
      router.refresh();
    } else if (res.error === 'duplicate_account') {
      setMsg({ tone: 'bad', text: t('signup.errDuplicateAccount') });
    } else if (res.error === 'not_found') {
      setMsg({ tone: 'bad', text: t('signup.errNotFound') });
      router.refresh();
    } else {
      setMsg({ tone: 'bad', text: res.error });
    }
  }

  async function reject(r: SignupRequestRow) {
    if (!window.confirm(t('signup.rejectConfirm', { email: r.email }))) return;
    setMsg(null);
    setBusyId(r.id);
    window.dispatchEvent(new Event('ddc:sync'));
    const res = await rejectSignupAction(r.id);
    setBusyId(null);
    if (res.ok) {
      router.refresh();
    } else if (res.error === 'not_found') {
      setMsg({ tone: 'bad', text: t('signup.errNotFound') });
      router.refresh();
    } else {
      setMsg({ tone: 'bad', text: res.error });
    }
  }

  return (
    <div className="space-y-2">
      {msg && <p className={`sumbar ${msg.tone}`} data-auth="signup-msg">{msg.text}</p>}
      {requests.length === 0 ? (
        <p className="hintline">{t('signup.pendingEmpty')}</p>
      ) : (
        <div className="scroll" style={{ maxHeight: 360 }}>
          <table className="tbl sticky" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>{t('signup.fullName')}</th>
                <th>{t('signup.companyEmail')}</th>
                <th>{t('signup.department')}</th>
                <th>{t('signup.colSubmitted')}</th>
                <th>{t('signup.colRole')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} data-signup-row={r.email}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>{r.email}</td>
                  <td>{r.departmentName ?? '-'}</td>
                  <td>{formatDate(r.createdAt, locale)}</td>
                  <td>
                    <select
                      className="inp"
                      style={{ width: 'auto' }}
                      value={roles[r.id] ?? 'viewer'}
                      onChange={(e) => setRoles((prev) => ({ ...prev, [r.id]: e.target.value as Role }))}
                      aria-label={t('signup.colRole')}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>{roleLabel(role)}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button type="button" className="btn" disabled={busyId === r.id} onClick={() => approve(r)}>
                        {t('signup.approve')}
                      </button>
                      <button type="button" className="btn ghost" disabled={busyId === r.id} onClick={() => reject(r)}>
                        {t('signup.reject')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
