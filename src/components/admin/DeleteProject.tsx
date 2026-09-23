'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { removeProjectAction } from '@/server/actions';

export function DeleteProject({ projects }: { projects: { id: number; name: string; code: string }[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [id, setId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function del() {
    if (!id) return;
    if (!window.confirm(t('admin.confirmDelete'))) return;
    window.dispatchEvent(new Event('ddc:sync'));
    setBusy(true);
    const res = await removeProjectAction(id);
    if (res.ok) {
      setMsg(t('admin.deleted'));
      setId(0);
      router.refresh();
    } else {
      setMsg(res.error ?? 'Error');
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={id}
        onChange={(e) => setId(Number(e.target.value))}
        className="inp min-w-0 flex-1 sm:max-w-xs"
      >
        <option value={0}>{t('common.select')}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} - {p.name}
          </option>
        ))}
      </select>
      <button
        onClick={del}
        disabled={busy || !id}
        className="btn danger disabled:opacity-40"
      >
        {t('admin.delete')}
      </button>
      {msg && <span className="chip c-ok">{msg}</span>}
    </div>
  );
}
