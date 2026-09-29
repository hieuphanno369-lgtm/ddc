'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { DepartmentRow } from '@/server/repo/signup-types';
import { deleteDepartmentAction, saveDepartmentAction, setDepartmentActiveAction } from '@/server/actions-signup-admin';

/** P3F-3 - danh mục Phòng ban (hiện ở form Đăng ký): thêm, đổi tên, ẩn/hiện lại, xoá khi chưa ai dùng. Khuôn `FactoryEditor.tsx`. */
export function DepartmentEditor({ departments }: { departments: DepartmentRow[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<number, string>>(() => Object.fromEntries(departments.map((d) => [d.id, d.name])));
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const nameOf = (d: DepartmentRow) => drafts[d.id] ?? d.name;

  async function save(id: number | undefined, name: string) {
    setErr(null);
    if (!name.trim() || name.trim().length > 100) {
      setErr(t('department.errInvalid'));
      return;
    }
    const res = await saveDepartmentAction({ id, name });
    if (res.ok) {
      if (id === undefined) setNewName('');
      router.refresh();
    } else {
      setErr(t(res.error === 'duplicate_name' ? 'department.errDuplicate' : 'department.errInvalid'));
    }
  }

  async function toggle(d: DepartmentRow) {
    setErr(null);
    const res = await setDepartmentActiveAction(d.id, !d.isActive);
    if (res.ok) router.refresh();
    else setErr(t('department.errInvalid'));
  }

  async function remove(d: DepartmentRow) {
    if (!window.confirm(t('department.confirmDelete', { name: d.name }))) return;
    setErr(null);
    const res = await deleteDepartmentAction(d.id);
    if (res.ok) router.refresh();
    else if (res.error === 'in_use') setErr(t('department.errInUse', { count: res.count ?? 0 }));
    else router.refresh();
  }

  return (
    <div className="space-y-2">
      {err && <p className="sumbar bad">{err}</p>}
      <div className="scroll" style={{ maxHeight: 320 }}>
        <table className="tbl sticky" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th>{t('department.name')}</th>
              <th>{t('department.status')}</th>
              <th>{t('department.users')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id} data-department-row={d.name}>
                <td>
                  <input
                    value={nameOf(d)}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    className="inp"
                    aria-label={t('department.name')}
                    maxLength={100}
                  />
                </td>
                <td>{d.isActive ? t('department.active') : t('department.hidden')}</td>
                <td>{d.userCount}</td>
                <td>
                  <div className="flex gap-2">
                    <button type="button" className="btn ghost" onClick={() => save(d.id, nameOf(d))}>{t('department.save')}</button>
                    <button type="button" className="btn ghost" onClick={() => toggle(d)}>
                      {d.isActive ? t('department.hide') : t('department.show')}
                    </button>
                    {d.userCount + d.pendingCount === 0 && (
                      <button type="button" className="btn ghost" onClick={() => remove(d)}>{t('department.delete')}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="inp"
                  aria-label={t('department.name')}
                  maxLength={100}
                  data-department-new=""
                />
              </td>
              <td />
              <td />
              <td>
                <button type="button" className="btn" onClick={() => save(undefined, newName)}>{t('department.add')}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="hintline">{t('department.hint')}</p>
    </div>
  );
}
